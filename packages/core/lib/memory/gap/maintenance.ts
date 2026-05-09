import { logger } from '../../logger';
import { BaseMemoryProvider } from '../base';
import { InsightCategory, ContextualScope } from '../../types/memory';
import { GapStatus } from '../../types/agent';
import { queryByTypeAndMap } from '../utils';
import { LIMITS, TIME, RETENTION } from '../../constants';

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
