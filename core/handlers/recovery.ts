import { CodeBuildClient, StartBuildCommand } from '@aws-sdk/client-codebuild';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { logger } from '../lib/logger';
import { SSTResource } from '../lib/types/index';
import { DynamoLockManager } from '../lib/lock';
import { DynamoMemory } from '../lib/memory';

const codebuild = new CodeBuildClient({});
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const typedResource = Resource as unknown as SSTResource;
const lockManager = new DynamoLockManager();
const memory = new DynamoMemory();

const RECOVERY_LOCK_ID = 'dead-mans-switch-recovery';
// TTL slightly longer than the Dead Man's Switch schedule (15 min) to guarantee one-at-a-time.
const RECOVERY_LOCK_TTL_SECONDS = 20 * 60;

/**
 * Performs a health check on the system and triggers an emergency recovery (rollback) if unhealthy.
 *
 * @param event - Optional event payload.
 * @returns A promise that resolves when the recovery check is complete.
 */
export const handler = async (_event?: { detail: Record<string, unknown> }): Promise<void> => {
  const healthUrl = `${typedResource.WebhookApi.url}/health`;
  logger.info(`Dead Man's Switch checking health at: ${healthUrl}`);

  try {
    const response = await fetch(healthUrl);
    if (!response.ok) {
      throw new Error(`Health endpoint returned ${response.status}`);
    }

    // DEEP HEALTH: Verify EventBridge accessibility
    const { EventBridgeClient, ListEventBusesCommand } =
      await import('@aws-sdk/client-eventbridge');
    const eb = new EventBridgeClient({});
    await eb.send(new ListEventBusesCommand({ NamePrefix: typedResource.AgentBus.name }));

    logger.info('System is healthy (Deep Check PASSED). No action needed.');
    return;
  } catch (error) {
    logger.error(
      `System health check FAILED: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // If we reach here, the health check failed or timed out.
  // CRITICAL: Triggering Emergency Recovery
  logger.info("CRITICAL: Initiating Dead Man's Switch Recovery Flow...");

  const lockAcquired = await lockManager.acquire(RECOVERY_LOCK_ID, RECOVERY_LOCK_TTL_SECONDS);
  if (!lockAcquired) {
    logger.info(
      "Dead Man's Switch: Recovery already in progress (lock held). Skipping duplicate trigger."
    );
    return;
  }

  try {
    // 1. Retrieve Last Known Good (LKG) Hash
    const lkgHash = await memory.getLatestLKGHash();
    if (!lkgHash) {
      logger.warn('No LKG hash found in memory. Falling back to generic HEAD revert.');
    }

    logger.info(
      `Triggering CodeBuild Deployer for emergency recovery to LKG: ${lkgHash || 'HEAD^'}...`
    );
    const command = new StartBuildCommand({
      projectName: typedResource.Deployer.name,
      environmentVariablesOverride: [
        { name: 'EMERGENCY_ROLLBACK', value: 'true' },
        { name: 'LKG_HASH', value: lkgHash || '' },
      ],
    });

    await codebuild.send(command);

    // 2. Log recovery event for SuperClaw awareness
    await db.send(
      new PutCommand({
        TableName: typedResource.MemoryTable.name,
        Item: {
          userId: 'DISTILLED#RECOVERY',
          timestamp: Date.now(),
          content: `Dead Man's Switch detected unhealthy system and triggered emergency rollback to ${lkgHash || 'previous state'}.`,
        },
      })
    );

    logger.info('Emergency recovery initiated successfully.');
  } catch (recoveryError) {
    logger.error("FATAL: Dead Man's Switch recovery flow failed!", recoveryError);
    await lockManager.release(RECOVERY_LOCK_ID);
  }
};
