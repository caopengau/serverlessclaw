import { logger } from '../../logger';
import { MEMORY_KEYS } from '../../constants';
import type { BaseMemoryProvider } from '../base';
import { normalizeGapId } from '../utils';

const GAP_LOCK_TTL_MS = 30 * 60 * 1000;

/**
 * Acquires a lock on a gap to prevent concurrent modification.
 */
export async function acquireGapLock(
  base: BaseMemoryProvider,
  gapId: string,
  agentId: string,
  ttlMs: number = GAP_LOCK_TTL_MS,
  scope?: string | import('../../types/memory').ContextualScope
): Promise<boolean> {
  const normalizedGapId = normalizeGapId(gapId);
  const lockKey = base.getScopedUserId(`${MEMORY_KEYS.GAP_LOCK_PREFIX}${normalizedGapId}`, scope);
  const now = Date.now();
  const expiresAt = Math.floor((now + ttlMs) / 1000);

  try {
    await base.updateItem({
      Key: { userId: lockKey, timestamp: 0 },
      UpdateExpression:
        'SET #tp = :type, #content = :agentId, #status = :locked, expiresAt = :exp, acquiredAt = :now, lockVersion = :version',
      ConditionExpression: 'attribute_not_exists(userId) OR expiresAt < :nowSec',
      ExpressionAttributeNames: { '#tp': 'type', '#content': 'agentId', '#status': 'status' },
      ExpressionAttributeValues: {
        ':type': 'GAP_LOCK',
        ':agentId': agentId,
        ':locked': 'LOCKED',
        ':exp': expiresAt,
        ':now': now,
        ':nowSec': Math.floor(now / 1000),
        ':version': now,
      },
    });
    return true;
  } catch (error: unknown) {
    if ((error as Error).name === 'ConditionalCheckFailedException') {
      try {
        const { EVOLUTION_METRICS } = await import('../../metrics/evolution-metrics');
        const workspaceId = typeof scope === 'string' ? scope : scope?.workspaceId;
        EVOLUTION_METRICS.recordLockContention(normalizedGapId, agentId, { workspaceId });
      } catch (e) {
        logger.debug('Failed to record evolution metrics:', e);
      }
    }
    return false;
  }
}

/**
 * Releases a gap lock.
 */
export async function releaseGapLock(
  base: BaseMemoryProvider,
  gapId: string,
  agentId: string,
  expectedVersion: number = 0,
  force: boolean = false,
  scope?: string | import('../../types/memory').ContextualScope
): Promise<void> {
  const normalizedGapId = normalizeGapId(gapId);
  const lockKey = base.getScopedUserId(`${MEMORY_KEYS.GAP_LOCK_PREFIX}${normalizedGapId}`, scope);

  const conditionExpr = force
    ? 'attribute_exists(userId)'
    : '#content = :agentId' + (expectedVersion > 0 ? ' AND lockVersion = :version' : '');
  const exprValues: Record<string, unknown> = { ':agentId': agentId };
  if (expectedVersion > 0) exprValues[':version'] = expectedVersion;

  try {
    await base.deleteItem({
      userId: lockKey,
      timestamp: 0,
      ConditionExpression: conditionExpr,
      ExpressionAttributeNames: { '#content': 'agentId' },
      ExpressionAttributeValues: exprValues,
    });
  } catch (e) {
    logger.warn(`[releaseGapLock] Failed to release lock for gap ${gapId} by agent ${agentId}:`, e);
  }
}

/**
 * Checks if a gap is currently locked.
 */
export async function getGapLock(
  base: BaseMemoryProvider,
  gapId: string,
  scope?: string | import('../../types/memory').ContextualScope
): Promise<{ agentId: string; expiresAt: number; lockVersion?: number } | null> {
  const normalizedGapId = normalizeGapId(gapId);
  const lockKey = base.getScopedUserId(`${MEMORY_KEYS.GAP_LOCK_PREFIX}${normalizedGapId}`, scope);
  try {
    const items = await base.queryItems({
      KeyConditionExpression: 'userId = :lockKey AND #ts = :zero',
      ExpressionAttributeNames: { '#ts': 'timestamp' },
      ExpressionAttributeValues: { ':lockKey': lockKey, ':zero': 0 },
    });
    if (items.length === 0) return null;
    const lock = items[0];
    if ((lock.expiresAt as number) < Math.floor(Date.now() / 1000)) return null;
    return {
      agentId: lock.agentId as string,
      expiresAt: lock.expiresAt as number,
      lockVersion: lock.lockVersion as number,
    };
  } catch (e) {
    logger.warn(`[getGapLock] Check failed for gap ${gapId}:`, e);
    return { agentId: '__LOCK_CHECK_FAILED__', expiresAt: Infinity };
  }
}
