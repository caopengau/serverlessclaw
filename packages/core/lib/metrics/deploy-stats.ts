import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SYSTEM } from '../constants';
import { logger } from '../logger';
import { getDocClient, getMemoryTableName } from '../utils/ddb-client';

const db = getDocClient();

/**
 * Retrieves the current deployment count for today.
 *
 * @param workspaceId - Optional workspace identifier for multi-tenant isolation.
 * @returns A promise that resolves to the current deployment count.
 * @since 2026-03-19
 */
export async function getDeployCountToday(workspaceId?: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const scopePrefix = workspaceId ? `WS#${workspaceId}#` : '';
  const pk = `${scopePrefix}${SYSTEM.DEPLOY_STATS_KEY ?? 'SYSTEM#DEPLOY_STATS'}`;

  const response = await db.send(
    new GetCommand({
      TableName: getMemoryTableName(),
      Key: {
        userId: pk,
        timestamp: 0,
      },
    })
  );
  const Item = response?.Item;

  return Item?.lastReset === today ? (Item?.count ?? 0) : 0;
}

/**
 * Atomically increments the deployment count for today.
 * Uses a two-step conditional strategy to correctly handle UTC day rollovers:
 * 1. Try same-day increment (fails if it's a new day OR limit reached).
 * 2. On failure: try new-day reset (fails if it's still the same day = limit hit).
 * 3. If both fail: limit reached, return false.
 *
 * @param today - The current date string (YYYY-MM-DD).
 * @param limit - The maximum allowed count before blocking.
 * @param workspaceId - Optional workspace identifier for multi-tenant isolation.
 * @returns A promise that resolves to true if incremented, false if limit reached.
 */
export async function incrementDeployCount(
  today: string,
  limit: number,
  workspaceId?: string
): Promise<boolean> {
  const scopePrefix = workspaceId ? `WS#${workspaceId}#` : '';
  const pk = `${scopePrefix}${SYSTEM.DEPLOY_STATS_KEY ?? 'SYSTEM#DEPLOY_STATS'}`;

  // Step 1: Same-day increment (most common hot path)
  try {
    await db.send(
      new UpdateCommand({
        TableName: getMemoryTableName(),
        Key: {
          userId: pk,
          timestamp: 0,
        },
        UpdateExpression: 'SET #count = #count + :one',
        ConditionExpression: 'lastReset = :today AND #count < :limit',
        ExpressionAttributeNames: { '#count': 'count' },
        ExpressionAttributeValues: { ':one': 1, ':today': today, ':limit': limit },
      })
    );
    return true;
  } catch (error: unknown) {
    if (!(error instanceof Error && error.name === 'ConditionalCheckFailedException')) {
      throw error;
    }
  }

  // Step 2: New UTC day (or first-ever record) — reset counter to 1.
  // This is only reached when lastReset ≠ today OR the record doesn't exist yet.
  try {
    await db.send(
      new UpdateCommand({
        TableName: getMemoryTableName(),
        Key: {
          userId: pk,
          timestamp: 0,
        },
        UpdateExpression: 'SET #count = :one, lastReset = :today',
        ConditionExpression: 'attribute_not_exists(lastReset) OR lastReset <> :today',
        ExpressionAttributeNames: { '#count': 'count' },
        ExpressionAttributeValues: { ':one': 1, ':today': today },
      })
    );
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
      // A concurrent call already reset the counter for today (race on day boundary).
      // Retry the same-day increment once.
      try {
        await db.send(
          new UpdateCommand({
            TableName: getMemoryTableName(),
            Key: {
              userId: pk,
              timestamp: 0,
            },
            UpdateExpression: 'SET #count = #count + :one',
            ConditionExpression: 'lastReset = :today AND #count < :limit',
            ExpressionAttributeNames: { '#count': 'count' },
            ExpressionAttributeValues: { ':one': 1, ':today': today, ':limit': limit },
          })
        );
        return true;
      } catch {
        logger.info('incrementDeployCount: limit reached, skipping increment.');
        return false;
      }
    }
    throw error;
  }
}

/**
 * Rewards a deployment limit (decrements the count, floored at 0).
 * Uses a conditional write to prevent the counter from going negative,
 * which would silently grant extra deploy budget beyond the configured limit.
 *
 * @param workspaceId - Optional workspace identifier for multi-tenant isolation.
 * @returns A promise that resolves to true if decremented, false otherwise.
 */
export async function rewardDeployLimit(workspaceId?: string): Promise<boolean> {
  const scopePrefix = workspaceId ? `WS#${workspaceId}#` : '';
  const pk = `${scopePrefix}${SYSTEM.DEPLOY_STATS_KEY ?? 'SYSTEM#DEPLOY_STATS'}`;

  try {
    await db.send(
      new UpdateCommand({
        TableName: getMemoryTableName(),
        Key: {
          userId: pk,
          timestamp: 0,
        },
        UpdateExpression: 'SET #count = #count - :one',
        ConditionExpression: 'attribute_exists(userId) AND #count > :zero',
        ExpressionAttributeNames: { '#count': 'count' },
        ExpressionAttributeValues: { ':one': 1, ':zero': 0 },
      })
    );
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
      return false;
    }
    throw error;
  }
}
