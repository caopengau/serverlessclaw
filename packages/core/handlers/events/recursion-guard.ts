import { logger } from '../../lib/logger';
import { isMissionContext } from './shared';
import {
  getRecursionLimit,
  incrementRecursionDepth,
  getRecursionDepth,
} from '../../lib/recursion-tracker';
import { routeToDlq } from '../route-to-dlq';
import { emitMetrics, METRICS } from '../../lib/metrics';
import { EventType } from '../../lib/types/agent';

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

  // Only increment depth for events that initiate or continue agent task dispatches.
  // Completion, timeout, and health alert events are popped off the stack and must not increment depth.
  const isDispatchEvent = [
    EventType.CONTINUATION_TASK,
    EventType.PARALLEL_TASK_DISPATCH,
    EventType.DELEGATION_TASK,
  ].includes(detailType as EventType);

  let currentDepth: number;
  if (isDispatchEvent) {
    currentDepth = await incrementRecursionDepth(traceId, sessionId, 'system.spine', {
      isMissionContext: isMission,
      workspaceId,
    });
  } else {
    // Just fetch the current depth without incrementing
    currentDepth = await getRecursionDepth(traceId, workspaceId);
  }

  if (isDispatchEvent && (currentDepth > recursionLimit || currentDepth === -1)) {
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
