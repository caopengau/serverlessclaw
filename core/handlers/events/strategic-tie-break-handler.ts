import { logger } from '../../lib/logger';
import { emitEvent, EventPriority } from '../../lib/utils/bus';

interface StrategicTieBreakPayload {
  userId: string;
  agentId: string;
  task: string;
  originalTask: string;
  question: string;
  traceId: string;
  initiatorId: string;
  sessionId?: string;
  depth?: number;
}

/**
 * Handles strategic tie-break events.
 * Dispatches a modified task to the target agent to continue evolution
 * after a human input or consensus timeout.
 */
export async function handleStrategicTieBreak(eventDetail: Record<string, unknown>): Promise<void> {
  const { userId, agentId, task, traceId, initiatorId, sessionId, depth } =
    eventDetail as unknown as StrategicTieBreakPayload;

  logger.warn(`[TIE_BREAK] Performing strategic tie-break for ${agentId} | traceId: ${traceId}`);

  // Re-emit as a task for the target agent to resume processing
  await emitEvent(
    'strategic-tie-break-handler',
    `${agentId}_task`,
    {
      userId,
      agentId,
      task,
      traceId,
      initiatorId,
      sessionId,
      depth,
      isContinuation: true, // Signal that this is a continuation after timeout
    },
    { priority: EventPriority.HIGH }
  );

  logger.info(`[TIE_BREAK] Dispatched continuation task to ${agentId}`);
}
