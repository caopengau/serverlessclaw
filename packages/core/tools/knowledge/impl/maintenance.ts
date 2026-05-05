import { memorySchema } from '../definitions/memory';
import { formatErrorMessage } from '../../../lib/utils/error';
import { logger } from '../../../lib/logger';

import { getMemory } from '../utils';

/**
 * Deletes execution traces from the TraceTable.
 */
export const deleteTraces = {
  ...memorySchema.deleteTraces,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const { traceId } = args as { traceId: string };
    if (!traceId) return 'FAILED: traceId is required.';

    try {
      const sst = await import('sst');
      const { Resource } = sst;
      const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
      const { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand, QueryCommand } =
        await import('@aws-sdk/lib-dynamodb');

      const tableName = (Resource as unknown as Record<string, { name?: string }>).TraceTable?.name;
      if (!tableName) return 'FAILED: TraceTable not linked.';

      const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

      if (traceId === 'all') {
        const MAX_DELETE_LIMIT = 500;
        let deletedCount = 0;
        let lastKey: Record<string, unknown> | undefined;
        do {
          if (deletedCount >= MAX_DELETE_LIMIT) break;
          const scanRes = await docClient.send(
            new ScanCommand({ TableName: tableName, ExclusiveStartKey: lastKey, Limit: 50 })
          );
          if (scanRes.Items && scanRes.Items.length > 0) {
            for (let i = 0; i < scanRes.Items.length; i += 25) {
              if (deletedCount >= MAX_DELETE_LIMIT) break;
              const batch = scanRes.Items.slice(i, i + 25);
              await docClient.send(
                new BatchWriteCommand({
                  RequestItems: {
                    [tableName]: batch.map((item) => ({
                      DeleteRequest: { Key: { traceId: item.traceId, nodeId: item.nodeId } },
                    })),
                  },
                })
              );
              deletedCount += batch.length;
            }
          }
          lastKey = scanRes.LastEvaluatedKey;
        } while (lastKey && deletedCount < MAX_DELETE_LIMIT);
        return `Successfully purged traces. ${deletedCount} nodes deleted (limit: ${MAX_DELETE_LIMIT}).`;
      }

      const { Items } = await docClient.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'traceId = :tid',
          ExpressionAttributeValues: { ':tid': traceId },
          ProjectionExpression: 'traceId, nodeId',
        })
      );

      if (!Items || Items.length === 0) return `No trace nodes found for ${traceId}`;

      for (let i = 0; i < Items.length; i += 25) {
        const batch = Items.slice(i, i + 25);
        await docClient.send(
          new BatchWriteCommand({
            RequestItems: {
              [tableName]: batch.map((item) => ({
                DeleteRequest: { Key: { traceId: item.traceId, nodeId: item.nodeId } },
              })),
            },
          })
        );
      }
      return `Successfully deleted trace ${traceId}.`;
    } catch (error) {
      return `Failed to delete traces: ${formatErrorMessage(error)}`;
    }
  },
};

/**
 * Force-releases a distributed lock by deleting it from memory.
 */
export const forceReleaseLock = {
  ...memorySchema.forceReleaseLock,
  requiredPermissions: ['config:update'],
  execute: async (
    args: Record<string, unknown>,
    context?: { userId?: string }
  ): Promise<string> => {
    const { lockId } = args as { lockId: string };
    if (!lockId) return 'FAILED: lockId is required.';

    if (!lockId.startsWith('LOCK#')) {
      return `FAILED: Invalid lockId format. Must start with 'LOCK#'.`;
    }

    if (context?.userId) {
      const { getIdentityManager, UserRole } = await import('../../../lib/session/identity');
      const identity = await getIdentityManager();
      const user = await identity.getUser(context.userId);

      if (!user || (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN)) {
        logger.warn(`Unauthorized forceReleaseLock attempt by ${context.userId} on ${lockId}`);
        return 'FAILED: Unauthorized. Only OWNER or ADMIN can force release locks.';
      }
    }

    try {
      await getMemory().deleteItem({
        userId: lockId,
        timestamp: 0,
        ConditionExpression: '#type = :lockType',
        ExpressionAttributeNames: { '#type': 'type' },
        ExpressionAttributeValues: { ':lockType': 'LOCK' },
      });
      logger.info(`Lock force-released by ${context?.userId ?? 'system'}: ${lockId}`);
      return `Successfully force-released lock: ${lockId}`;
    } catch (error) {
      if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
        return `FAILED: Item ${lockId} is not a valid lock or has already been released.`;
      }
      return `Failed to release lock: ${formatErrorMessage(error)}`;
    }
  },
};
