/**
 * Gap Operations Module
 * Contains gap management methods for the DynamoMemory class.
 */

import { MemoryInsight, InsightMetadata, InsightCategory, ContextualScope } from '../types/memory';
import { GapStatus, EvolutionTrack, GapTransitionResult } from '../types/agent';
import { logger } from '../logger';
import { RetentionManager } from './tiering';
import { LIMITS, TIME, MEMORY_KEYS, RETENTION } from '../constants';
import type { BaseMemoryProvider } from './base';
import {
  createMetadata,
  queryByTypeAndMap,
  normalizeGapId,
  getGapIdPK,
  getGapTimestamp,
  resolveItemById,
  atomicUpdateMetadata,
  atomicIncrement,
} from './utils';

import { determineTrack } from './gap/tracks';
export { determineTrack };
export { acquireGapLock, releaseGapLock, getGapLock } from './gap/locks';

/** Minimal interface for track operations. */
export interface TrackStore {
  putItem(item: Record<string, unknown>): Promise<void>;
  queryItems(params: Record<string, unknown>): Promise<Record<string, unknown>[]>;
}

/**
 * Retrieves all capability gaps filtered by status.
 */
export async function getAllGaps(
  base: BaseMemoryProvider,
  status: GapStatus = GapStatus.OPEN,
  scope?: string | ContextualScope
): Promise<MemoryInsight[]> {
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
 * Archives stale gaps that have been open for longer than the specified days.
 */
export async function archiveStaleGaps(
  base: BaseMemoryProvider,
  staleDays: number = LIMITS.STALE_GAP_DAYS,
  scope?: string | ContextualScope
): Promise<number> {
  const cutoffTime = Date.now() - staleDays * TIME.SECONDS_IN_DAY * TIME.MS_PER_SECOND;

  const gaps = await queryByTypeAndMap(
    base,
    'GAP',
    InsightCategory.STRATEGIC_GAP,
    200,
    '#status IN (:open, :planned)',
    {
      ':open': GapStatus.OPEN,
      ':planned': GapStatus.PLANNED,
    },
    undefined,
    scope
  );

  const staleGaps = gaps.filter((gap) => gap.createdAt && gap.createdAt < cutoffTime);

  let archived = 0;
  for (const gap of staleGaps) {
    try {
      await base.updateItem({
        Key: { userId: gap.id, timestamp: gap.timestamp },
        UpdateExpression: 'SET #status = :archived, updatedAt = :now',
        ConditionExpression: '#status IN (:open, :planned)',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':archived': GapStatus.ARCHIVED,
          ':open': GapStatus.OPEN,
          ':planned': GapStatus.PLANNED,
          ':now': Date.now(),
        },
      });
      archived++;
      logger.info(`Archived stale gap: ${gap.id}`);
    } catch (e: unknown) {
      logger.warn(`Failed to archive gap ${gap.id}:`, e);
    }
  }

  return archived;
}

/**
 * Culls resolved gaps that are older than the retention threshold.
 */
export async function cullResolvedGaps(
  base: BaseMemoryProvider,
  thresholdDays: number = RETENTION.GAPS_DAYS,
  scope?: string | ContextualScope
): Promise<number> {
  const cutoffTime = Date.now() - thresholdDays * TIME.SECONDS_IN_DAY * TIME.MS_PER_SECOND;

  const gaps = await queryByTypeAndMap(
    base,
    'GAP',
    InsightCategory.STRATEGIC_GAP,
    200,
    '#status IN (:done, :deployed)',
    {
      ':done': GapStatus.DONE,
      ':deployed': GapStatus.DEPLOYED,
    },
    undefined,
    scope
  );

  const staleGaps = gaps.filter((gap) => gap.createdAt && gap.createdAt < cutoffTime);

  let deleted = 0;
  for (const gap of staleGaps) {
    try {
      await base.deleteItem({
        userId: gap.id,
        timestamp: gap.timestamp,
      });
      deleted++;
      logger.info(`Culled resolved gap: ${gap.id}`);
    } catch (e: unknown) {
      logger.warn(`Failed to cull gap ${gap.id}:`, e);
    }
  }

  return deleted;
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
  metadata: Record<string, unknown> = {}
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

  const metadataEntries = Object.entries(metadata);
  if (metadataEntries.length > 0) {
    const metaExpr = metadataEntries
      .map((_, idx) => `${metadataEntries[idx][0]} = :metaVal${idx}`)
      .join(', ');
    metadataEntries.forEach(([, val], idx) => {
      exprValues[`:metaVal${idx}`] = val;
    });
    updateExpr += ', ' + metaExpr;
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
          const { EVOLUTION_METRICS } = await import('../metrics/evolution-metrics');
          const workspaceId = typeof scope === 'string' ? scope : scope?.workspaceId;
          EVOLUTION_METRICS.recordTransitionRejection(
            gapId,
            target.status ?? 'unknown',
            status,
            'guard-mismatch',
            {
              workspaceId,
            }
          );
        } catch (e) {
          logger.debug('Failed to record evolution metrics:', e);
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
 * Assigns a gap to an evolution track.
 */
export async function assignGapToTrack(
  base: TrackStore,
  gapId: string,
  track: EvolutionTrack,
  priority: number = 5,
  scope?: string | ContextualScope
): Promise<void> {
  const transitionResult = await updateGapStatus(
    base as unknown as BaseMemoryProvider,
    gapId,
    GapStatus.PLANNED,
    scope
  );
  if (!transitionResult.success) {
    throw new Error(
      `[GapTrack] Failed to transition ${gapId} to PLANNED: ${transitionResult.error}`
    );
  }

  const normalizedId = normalizeGapId(gapId);
  const getScopedUserId = (id: string, s?: string | ContextualScope) => {
    const provider = base as unknown as { getScopedUserId?: (id: string, s?: unknown) => string };
    if (typeof provider.getScopedUserId === 'function') {
      return provider.getScopedUserId(id, s);
    }
    const wid = typeof s === 'string' ? s : s?.workspaceId;
    return wid ? `WS#${wid}#${id}` : id;
  };

  await base.putItem({
    userId: getScopedUserId(`${MEMORY_KEYS.TRACK_PREFIX}${normalizedId}`, scope),
    timestamp: 0,
    type: 'TRACK_ASSIGNMENT',
    gapId: normalizedId,
    track,
    priority,
    assignedAt: Date.now(),
    createdAt: Date.now(),
    expiresAt: Math.floor(Date.now() / 1000) + RETENTION.GAPS_DAYS * 86400,
  });
}

/**
 * Gets the track assignment for a gap.
 */
export async function getGapTrack(
  base: TrackStore,
  gapId: string,
  scope?: string | ContextualScope
): Promise<{ track: EvolutionTrack; priority: number } | null> {
  const normalizedId = normalizeGapId(gapId);
  const getScopedUserId = (id: string, s?: string | ContextualScope) => {
    const provider = base as unknown as { getScopedUserId?: (id: string, s?: unknown) => string };
    if (typeof provider.getScopedUserId === 'function') {
      return provider.getScopedUserId(id, s);
    }
    const wid = typeof s === 'string' ? s : s?.workspaceId;
    return wid ? `WS#${wid}#${id}` : id;
  };

  try {
    const items = await base.queryItems({
      KeyConditionExpression: 'userId = :pk AND #ts = :zero',
      ExpressionAttributeNames: { '#ts': 'timestamp' },
      ExpressionAttributeValues: {
        ':pk': getScopedUserId(`${MEMORY_KEYS.TRACK_PREFIX}${normalizedId}`, scope),
        ':zero': 0,
      },
    });
    if (items.length === 0) return null;
    return { track: items[0].track as EvolutionTrack, priority: items[0].priority as number };
  } catch (e) {
    logger.warn(`[getGapTrack] Retrieval failed for gap ${gapId}:`, e);
    return null;
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
  const normalizedId = normalizeGapId(gapId);
  const gapTimestamp = getGapTimestamp(normalizedId);
  const scopedUserId = base.getScopedUserId(getGapIdPK(normalizedId), scope);

  if (gapTimestamp < TIME.EPOCH_2020_MS) {
    const target = await resolveItemById(base, gapId, 'GAP', scope);
    if (target) {
      try {
        await atomicUpdateMetadata(base, target.id, target.timestamp, metadata, scope);
        return;
      } catch (e) {
        logger.debug(`[updateGapMetadata] Atomic update failed for ${target.id}:`, e);
      }
    }
    if (gapTimestamp !== 0) {
      try {
        await atomicUpdateMetadata(base, scopedUserId, gapTimestamp, metadata, scope);
      } catch (e) {
        logger.debug(`[updateGapMetadata] Direct atomic update failed for ${scopedUserId}:`, e);
      }
    }
    return;
  }

  try {
    await atomicUpdateMetadata(base, scopedUserId, gapTimestamp, metadata, scope);
  } catch (e) {
    logger.debug(`[updateGapMetadata] Primary atomic update failed for ${scopedUserId}:`, e);
    const target = await resolveItemById(base, gapId, 'GAP', scope);
    if (target) {
      try {
        await atomicUpdateMetadata(base, target.id, target.timestamp, metadata, scope);
      } catch (e2) {
        logger.debug(`[updateGapMetadata] Fallback atomic update failed for ${target.id}:`, e2);
      }
    }
  }
}
