import { CodeBuildClient, StartBuildCommand } from '@aws-sdk/client-codebuild';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { logger } from '../lib/logger';
import { SSTResource } from '../lib/types/index';

const codebuild = new CodeBuildClient({});
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const typedResource = Resource as unknown as SSTResource;

/**
 * Performs a health check on the system and triggers an emergency recovery (rollback) if unhealthy.
 *
 * @returns A promise that resolves when the recovery check is complete.
 */
export const handler = async (): Promise<void> => {
  const healthUrl = `${typedResource.WebhookApi.url}/health`;
  logger.info(`Dead Man's Switch checking health at: ${healthUrl}`);

  try {
    const response = await fetch(healthUrl);
    if (response.ok) {
      logger.info('System is healthy. No action needed.');
      return;
    }
    logger.error(`System health check FAILED with status: ${response.status}`);
  } catch (error) {
    logger.error(
      `System health check FAILED with error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // If we reach here, the health check failed or timed out.
  // CRITICAL: Triggering Emergency Recovery
  logger.info("CRITICAL: Initiating Dead Man's Switch Recovery Flow...");

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
  }
};
