import { logger } from '../../logger';
import { BaseMemoryProvider } from '../base';
import {
  MemoryInsight,
  InsightCategory,
  ContextualScope,
  InsightMetadata,
} from '../../types/memory';
import { GapStatus, GapTransitionResult } from '../../types/agent';
import { resolveItemById, atomicIncrement, atomicUpdateMetadata } from '../utils';

/**
 * Retrieves all capability gaps filtered by status.
 */
export async function getAllGaps(
  base: BaseMemoryProvider,
  status: GapStatus = GapStatus.OPEN,
  scope?: string | ContextualScope
): Promise<MemoryInsight[]> {
  const { queryByTypeAndMap } = await import('../utils');
  return queryByTypeAndMap(
    base,
    'GAP',
    InsightCategory.STRATEGIC_GAP,
    100,
    '#status = :status',
    { ':status': status },
    undefined,
    scope
  );
}

/**
 * Records a new capability gap.
 */
export async function setGap(
  base: BaseMemoryProvider,
  gapId: string,
  details: string,
  metadata?: Partial<InsightMetadata>,
  scope?: string | ContextualScope
): Promise<void> {
  const { RetentionManager } = await import('../tiering');
  const { normalizeGapId, getGapTimestamp, getGapIdPK, createMetadata } = await import('../utils');

  const { expiresAt, type } = await RetentionManager.getExpiresAt('GAP', '');
  const normalizedGapId = normalizeGapId(gapId);
  const timestamp = getGapTimestamp(normalizedGapId);

  await base.putItem({
    userId: base.getScopedUserId(getGapIdPK(normalizedGapId), scope),
    timestamp: timestamp,
    createdAt: timestamp || Date.now(),
    type,
    expiresAt,
    content: details,
    status: GapStatus.OPEN,
    metadata: createMetadata(metadata ?? { category: InsightCategory.STRATEGIC_GAP }, timestamp),
  });
}

/**
 * Retrieves a specific capability gap by its ID.
 */
export async function getGap(
  base: BaseMemoryProvider,
  gapId: string,
  scope?: string | ContextualScope
): Promise<MemoryInsight | null> {
  return resolveItemById(base, gapId, 'GAP', scope);
}

/**
 * Atomically increments the attempt counter on a capability gap.
 */
export async function incrementGapAttemptCount(
  base: BaseMemoryProvider,
  gapId: string,
  scope?: string | ContextualScope
): Promise<number> {
  const target = await resolveItemById(base, gapId, 'GAP', scope);
  if (!target) {
    logger.warn(`[incrementGapAttemptCount] Abandoning increment: Gap ${gapId} not found.`);
    return 0;
  }

  return atomicIncrement(base, target.id, target.timestamp, 'retryCount', true);
}

/**
 * Transitions a capability gap to a new status.
 */
export async function updateGapStatus(
  base: BaseMemoryProvider,
  gapId: string,
  status: GapStatus,
  scope?: string | ContextualScope,
  metadata?: Record<string, unknown>
): Promise<GapTransitionResult> {
  const target = await resolveItemById(base, gapId, 'GAP', scope);
  if (!target) {
    return { success: false, error: `Gap ${gapId} not found in any status` };
  }

  const TRANSITION_GUARDS: Partial<
    Record<GapStatus, { expectedStatus: GapStatus; valueKey: string }>
  > = {
    [GapStatus.PLANNED]: { expectedStatus: GapStatus.OPEN, valueKey: ':expectedStatus' },
    [GapStatus.PROGRESS]: { expectedStatus: GapStatus.PLANNED, valueKey: ':expectedStatus' },
    [GapStatus.DEPLOYED]: { expectedStatus: GapStatus.PROGRESS, valueKey: ':expectedStatus' },
    [GapStatus.PENDING_APPROVAL]: {
      expectedStatus: GapStatus.DEPLOYED,
      valueKey: ':expectedStatus',
    },
    [GapStatus.DONE]: { expectedStatus: GapStatus.DEPLOYED, valueKey: ':expectedStatus' },
  };

  const guard = TRANSITION_GUARDS[status];
  let updateExpr = 'SET #status = :status, updatedAt = :now';
  const exprValues: Record<string, unknown> = {
    ':status': status,
    ':targetId': target.id,
    ':now': Date.now(),
    ...(guard ? { ':expectedStatus': guard.expectedStatus } : {}),
  };
  const exprNames: Record<string, string> = { '#status': 'status' };

  if (metadata) {
    const metaEntries = Object.entries(metadata).map(([key], idx) => {
      return `${key} = :metaVal${idx}`;
    });
    Object.entries(metadata).forEach(([key], idx) => {
      exprValues[`:metaVal${idx}`] = metadata[key];
    });
    updateExpr += ', ' + metaEntries.join(', ');
  }

  const params: Record<string, unknown> = {
    Key: { userId: target.id, timestamp: target.timestamp },
    UpdateExpression: updateExpr,
    ConditionExpression: guard
      ? 'attribute_exists(userId) AND userId = :targetId AND #status = :expectedStatus'
      : 'attribute_exists(userId) AND userId = :targetId',
    ExpressionAttributeNames: exprNames,
    ExpressionAttributeValues: exprValues,
  };

  try {
    await base.updateItem(params);
    return { success: true };
  } catch (error) {
    const err = error as { name?: string };
    if (err.name === 'ConditionalCheckFailedException') {
      if (guard) {
        try {
          const { EVOLUTION_METRICS } = await import('../../metrics/evolution-metrics');
          const workspaceId = typeof scope === 'string' ? scope : scope?.workspaceId;
          EVOLUTION_METRICS.recordTransitionRejection(
            gapId,
            target.status ?? 'unknown',
            status,
            'guard-mismatch',
            { workspaceId }
          );
        } catch {
          /* ignore */
        }
        return {
          success: false,
          error: `Cannot transition gap ${gapId} from ${target.status} to ${status}: expected ${guard.expectedStatus}`,
        };
      }
      return { success: false, error: `Gap ${gapId} status update rejected by guard.` };
    }
    logger.error(`[updateGapStatus] Failed for gap ${gapId}:`, error);
    return { success: false, error: `Update failed: ${String(error)}` };
  }
}

/**
 * Updates gap metadata.
 */
export async function updateGapMetadata(
  base: BaseMemoryProvider,
  gapId: string,
  metadata: Record<string, unknown>,
  scope?: string | ContextualScope
): Promise<void> {
  const { normalizeGapId, getGapTimestamp, getGapIdPK } = await import('../utils');
  const { TIME } = await import('../../constants');

  const normalizedId = normalizeGapId(gapId);
  const gapTimestamp = getGapTimestamp(normalizedId);
  const scopedUserId = base.getScopedUserId(getGapIdPK(normalizedId), scope);

  if (gapTimestamp < TIME.EPOCH_2020_MS) {
    const target = await resolveItemById(base, gapId, 'GAP', scope);
    if (target) {
      await atomicUpdateMetadata(base, target.id, target.timestamp, metadata, scope).catch(
        () => {}
      );
      return;
    }
    // Leap of faith for numeric IDs (like GAP#42 in tests) even if resolution fails
    if (gapTimestamp !== 0) {
      await atomicUpdateMetadata(base, scopedUserId, gapTimestamp, metadata, scope).catch(() => {});
    }
    return;
  }

  await atomicUpdateMetadata(base, scopedUserId, gapTimestamp, metadata, scope).catch(async () => {
    const target = await resolveItemById(base, gapId, 'GAP', scope);
    if (target) {
      await atomicUpdateMetadata(base, target.id, target.timestamp, metadata, scope).catch(
        () => {}
      );
    }
  });
}
