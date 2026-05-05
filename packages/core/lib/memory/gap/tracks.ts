import { logger } from '../../logger';
import { EvolutionTrack, GapStatus } from '../../types/agent';
import { MEMORY_KEYS, RETENTION } from '../../constants';
import { normalizeGapId } from '../utils';
import type { BaseMemoryProvider } from '../base';

/** Minimal interface for track operations — satisfied by BaseMemoryProvider and DynamoMemory. */
export interface TrackStore {
  putItem(item: Record<string, unknown>): Promise<void>;
  queryItems(params: Record<string, unknown>): Promise<Record<string, unknown>[]>;
}

/**
 * Assigns a gap to an evolution track.
 */
export async function assignGapToTrack(
  base: TrackStore,
  gapId: string,
  track: EvolutionTrack,
  priority?: number,
  scope?: string | import('../../types/memory').ContextualScope
): Promise<void> {
  const { updateGapStatus } = await import('./core');
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
  const getScopedUserId = (id: string, s?: string | import('../../types/memory').ContextualScope) => {
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
    priority: priority ?? 5,
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
  scope?: string | import('../../types/memory').ContextualScope
): Promise<{ track: EvolutionTrack; priority: number } | null> {
  const normalizedId = normalizeGapId(gapId);
  const getScopedUserId = (id: string, s?: string | import('../../types/memory').ContextualScope) => {
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
    logger.warn(`[getGapTrack] Failed for gap ${gapId}:`, e);
    return null;
  }
}

/**
 * Determines the appropriate track for a gap based on its content keywords.
 */
export function determineTrack(content: string): EvolutionTrack {
  const lower = content.toLowerCase();
  if (lower.match(/security|auth|vulnerability|permission|secret|encrypt|xss|csrf|rbac/))
    return EvolutionTrack.SECURITY;
  if (lower.match(/latency|memory|cpu|optimize|slow|timeout|throughput|bottleneck|performance/))
    return EvolutionTrack.PERFORMANCE;
  if (lower.match(/lambda|sst|pipeline|infra|deployment|cloud/))
    return EvolutionTrack.INFRASTRUCTURE;
  if (lower.match(/refactor|duplicate|cleanup|debt|complexity/)) return EvolutionTrack.REFACTORING;
  return EvolutionTrack.FEATURE;
}
