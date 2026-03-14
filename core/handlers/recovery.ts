import { CodeBuildClient, StartBuildCommand } from '@aws-sdk/client-codebuild';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { logger } from '../lib/logger';
import { SSTResource } from '../lib/types/index';
import { DynamoLockManager } from '../lib/lock';

const codebuild = new CodeBuildClient({});
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const typedResource = Resource as unknown as SSTResource;
const lockManager = new DynamoLockManager();

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

  // Idempotency guard: prevent concurrent recoveries from racing (e.g., two Lambda invocations
  // triggered within the same 15-min window via at-least-once EventBridge delivery, or an
  // in-progress deploy that temporarily returns 5xx).
  const lockAcquired = await lockManager.acquire(RECOVERY_LOCK_ID, RECOVERY_LOCK_TTL_SECONDS);
  if (!lockAcquired) {
    logger.info(
      "Dead Man's Switch: Recovery already in progress (lock held). Skipping duplicate trigger."
    );
    return;
  }

  try {
    logger.info('Triggering CodeBuild Deployer for emergency recovery...');
    const command = new StartBuildCommand({
      projectName: typedResource.Deployer.name,
      // We could pass an environment variable to the build to tell it to revert first
      environmentVariablesOverride: [{ name: 'EMERGENCY_ROLLBACK', value: 'true' }],
    });

    await codebuild.send(command);

    // 2. Log recovery event for SuperClaw awareness
    await db.send(
      new PutCommand({
        TableName: typedResource.MemoryTable.name,
        Item: {
          userId: 'DISTILLED#RECOVERY',
          timestamp: Date.now(),
          content: "Dead Man's Switch detected unhealthy system and triggered emergency rollback.",
        },
      })
    );

    logger.info('Emergency recovery initiated successfully.');
  } catch (recoveryError) {
    logger.error("FATAL: Dead Man's Switch recovery flow failed!", recoveryError);
    // Release lock on failure so the next scheduled check can retry.
    await lockManager.release(RECOVERY_LOCK_ID);
  }
  // Note: on success we intentionally leave the lock in place for its full TTL.
  // The in-progress CodeBuild deploy will keep the system "in recovery" for that window.
};
