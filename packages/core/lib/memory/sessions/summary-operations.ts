import { RetentionManager } from '../tiering';
import type { BaseMemoryProvider } from '../base';
import { queryLatestContentByUserId } from '../utils';
import { logger } from '../../logger';

/**
 * Retrieves the latest summary for a conversation session.
 */
export async function getSummary(
  base: BaseMemoryProvider,
  userId: string,
  scope?: string | import('../../types/memory').ContextualScope
): Promise<string | null> {
  const scopedUserId = base.getScopedUserId(`SUMMARY#${userId}`, scope);
  const results = await queryLatestContentByUserId(base, scopedUserId, 1);
  return results[0] ?? null;
}

/**
 * Updates the latest summary for a conversation session.
 */
export async function updateSummary(
  base: BaseMemoryProvider,
  userId: string,
  summary: string,
  scope?: string | import('../../types/memory').ContextualScope
): Promise<void> {
  const { expiresAt } = await RetentionManager.getExpiresAt('SESSIONS', userId);
  const scopedUserId = base.getScopedUserId(`SUMMARY#${userId}`, scope);

  let workspaceId: string | undefined;
  if (typeof scope === 'string') {
    workspaceId = scope;
  } else if (scope) {
    workspaceId = scope.workspaceId;
  }

  let attempts = 0;
  let success = false;
  const baseTimestamp = Date.now();

  while (attempts < 5 && !success) {
    try {
      await base.putItem(
        {
          userId: scopedUserId,
          timestamp: baseTimestamp + attempts,
          type: 'SUMMARY',
          expiresAt,
          content: summary,
          workspaceId: workspaceId || undefined,
        },
        {
          ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(#ts)',
          ExpressionAttributeNames: { '#ts': 'timestamp' },
        }
      );
      success = true;
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'ConditionalCheckFailedException') {
        attempts++;
      } else {
        throw e;
      }
    }
  }

  if (!success) {
    logger.error(`[Summary] Failed to save summary after ${attempts} attempts (collision).`);
  }
}
