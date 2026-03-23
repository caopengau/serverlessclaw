import { logger } from '../../lib/logger';
import { wakeupInitiator } from './shared';

interface ParallelTaskCompletedEvent {
  userId: string;
  sessionId?: string;
  traceId?: string;
  initiatorId?: string;
  overallStatus: 'success' | 'partial' | 'failed';
  results: Array<{
    taskId: string;
    agentId: string;
    status: string;
    result?: string | null;
    error?: string | null;
  }>;
  taskCount: number;
  completedCount: number;
  elapsedMs?: number;
}

/**
 * Handles PARALLEL_TASK_COMPLETED events by waking up the initiator
 * with a formatted summary of the aggregated parallel dispatch results.
 *
 * @param eventDetail - The detail of the EventBridge event.
 */
export async function handleParallelTaskCompleted(
  eventDetail: Record<string, unknown>
): Promise<void> {
  const {
    userId,
    sessionId,
    traceId,
    initiatorId,
    overallStatus,
    results,
    taskCount,
    completedCount,
    elapsedMs,
  } = eventDetail as unknown as ParallelTaskCompletedEvent;

  if (!initiatorId) {
    logger.info(
      `Parallel dispatch completed but no initiatorId provided. TraceId: ${traceId ?? 'N/A'}`
    );
    return;
  }

  const statusEmoji =
    overallStatus === 'success' ? '✅' : overallStatus === 'partial' ? '⚠️' : '❌';

  const successCount = results.filter((r) => r.status === 'success').length;
  const failedCount = results.filter((r) => r.status === 'failed').length;
  const timeoutCount = results.filter((r) => r.status === 'timeout').length;

  // Build per-task summary
  const taskSummaries = results
    .map((r) => {
      const icon = r.status === 'success' ? '✅' : r.status === 'failed' ? '❌' : '⏰';
      const resultSnippet = r.result
        ? r.result.substring(0, 200)
        : r.error
          ? `Error: ${r.error.substring(0, 200)}`
          : 'No result';
      return `${icon} ${r.agentId} (${r.taskId}): ${resultSnippet}`;
    })
    .join('\n');

  const summary = [
    `${statusEmoji} **Parallel Dispatch Complete** (${overallStatus.toUpperCase()})`,
    `Tasks: ${completedCount}/${taskCount} completed | ✅ ${successCount} succeeded | ❌ ${failedCount} failed | ⏰ ${timeoutCount} timed out${elapsedMs ? ` | ⏱️ ${Math.round(elapsedMs / 1000)}s` : ''}`,
    '',
    '**Results:**',
    taskSummaries,
  ].join('\n');

  logger.info(
    `Parallel dispatch ${traceId ?? 'N/A'} completed with status ${overallStatus}. Waking up initiator ${initiatorId}.`
  );

  await wakeupInitiator(userId, initiatorId, summary, traceId, sessionId, 1);
}
