import { RetentionManager } from '../tiering';
import type { BaseMemoryProvider } from '../base';
import { queryLatestContentByUserId, atomicIncrement, putWithCollisionRetry } from '../utils';

/**
 * Saves the Last Known Good (LKG) commit hash after a successful health check.
 */
export async function saveLKGHash(
  base: BaseMemoryProvider,
  hash: string,
  scope?: string | import('../../types/memory').ContextualScope
): Promise<void> {
  const pk = base.getScopedUserId('SYSTEM#LKG', scope);
  const workspaceId = typeof scope === 'string' ? scope : scope?.workspaceId;
  const { expiresAt, type } = await RetentionManager.getExpiresAt('DISTILLED', pk);

  await putWithCollisionRetry(base, {
    userId: pk,
    type,
    expiresAt,
    content: hash,
    workspaceId: workspaceId || undefined,
  });
}

/**
 * Retrieves the most recent Last Known Good (LKG) commit hash.
 */
export async function getLatestLKGHash(
  base: BaseMemoryProvider,
  scope?: string | import('../../types/memory').ContextualScope
): Promise<string | null> {
  const pk = base.getScopedUserId('SYSTEM#LKG', scope);
  const results = await queryLatestContentByUserId(base, pk, 1);
  return results[0] ?? null;
}

/**
 * Atomically increments the system-wide recovery attempt count.
 */
export async function incrementRecoveryAttemptCount(
  base: BaseMemoryProvider,
  scope?: string | import('../../types/memory').ContextualScope
): Promise<number> {
  const pk = base.getScopedUserId('SYSTEM#RECOVERY#STATS', scope);
  return atomicIncrement(base, pk, 0, 'attempts', false);
}

/**
 * Resets the system-wide recovery attempt count.
 */
export async function resetRecoveryAttemptCount(
  base: BaseMemoryProvider,
  scope?: string | import('../../types/memory').ContextualScope
): Promise<void> {
  const pk = base.getScopedUserId('SYSTEM#RECOVERY#STATS', scope);
  await base.updateItem({
    Key: { userId: pk, timestamp: 0 },
    UpdateExpression: 'SET #field = :zero, updatedAt = :now',
    ExpressionAttributeNames: { '#field': 'attempts' },
    ExpressionAttributeValues: { ':zero': 0, ':now': Date.now() },
  });
}

/**
 * Saves a distilled recovery log for agent context.
 */
export async function saveDistilledRecoveryLog(
  base: BaseMemoryProvider,
  traceId: string,
  log: string,
  scope?: string | import('../../types/memory').ContextualScope
): Promise<void> {
  const pk = base.getScopedUserId('DISTILLED#RECOVERY', scope);
  const workspaceId = typeof scope === 'string' ? scope : scope?.workspaceId;
  const { expiresAt, type } = await RetentionManager.getExpiresAt('DISTILLED', pk);

  await putWithCollisionRetry(base, {
    userId: pk,
    type,
    expiresAt,
    content: log,
    traceId,
    workspaceId: workspaceId || undefined,
  });
}
