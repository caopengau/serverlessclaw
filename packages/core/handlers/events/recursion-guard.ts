import { logger } from '../../lib/logger';
import { isMissionContext } from './shared';
import { getRecursionLimit, incrementRecursionDepth } from '../../lib/recursion-tracker';
import { routeToDlq } from '../route-to-dlq';
import { emitMetrics, METRICS } from '../../lib/metrics';

/**
 * Checks and increments recursion depth for an event.
 * Returns true if limit is exceeded (and event is routed to DLQ), false otherwise.
 */
export async function checkRecursionLimit(
  event: { 'detail-type': string; detail: Record<string, unknown>; id?: string },
  detailType: string,
  eventDetail: Record<string, unknown>,
  traceId: string,
  sessionId: string,
  workspaceId?: string
): Promise<boolean> {
  const isMission = isMissionContext(detailType, eventDetail);
  const recursionLimit = await getRecursionLimit({ isMissionContext: isMission });
  const currentDepth = await incrementRecursionDepth(traceId, sessionId, 'system.spine', {
    isMissionContext: isMission,
    workspaceId,
  });

  if (currentDepth > recursionLimit || currentDepth === -1) {
    logger.warn(
      `[RECURSION] Limit exceeded for trace ${traceId} (Depth: ${currentDepth}, Limit: ${recursionLimit})`
    );
    await routeToDlq(
      event,
      detailType,
      'SYSTEM',
      traceId,
      `Recursion limit exceeded`,
      sessionId,
      workspaceId
    );
    emitMetrics([METRICS.dlqEvents(1, { workspaceId })]).catch(() => {});
    return true;
  }

  // Propagate updated depth to downstream handlers
  eventDetail.depth = currentDepth;
  return false;
}
