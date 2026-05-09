import { logger } from '../../../lib/logger';
import { EventType } from '../../../lib/types/agent/events';
import { emitTypedEvent } from '../../../lib/utils/typed-emit';
import { ConfigManager } from '../../../lib/registry/config';
import { emitMetrics, METRICS } from '../../../lib/metrics';

/**
 * Handles DAG task completion/failure and triggers the next step.
 */
export async function handleDagTaskOutcome(payload: any, isFailure: boolean): Promise<void> {
  const {
    userId,
    traceId,
    taskId,
    agentId,
    response,
    sessionId,
    depth,
    workspaceId,
    teamId,
    staffId,
    userRole,
  } = payload;

  logger.info(`DAG task ${taskId} completed. Triggering DAG Supervisor.`);
  await emitTypedEvent(
    'events.handler',
    isFailure ? EventType.DAG_TASK_FAILED : EventType.DAG_TASK_COMPLETED,
    {
      userId,
      traceId,
      taskId,
      agentId,
      response,
      error: isFailure ? response : undefined,
      sessionId,
      depth,
      workspaceId,
      teamId,
      staffId,
      userRole,
    }
  );
}

/**
 * Handles the final aggregation of parallel task results.
 */
export async function finalizeParallelDispatch(
  aggregateState: any,
  existingState: any,
  scope: { workspaceId?: string; teamId?: string; staffId?: string },
  aggregator: any
): Promise<void> {
  const { userId, traceId, workspaceId, teamId, staffId } = aggregateState;

  const threshold =
    ((await ConfigManager.getRawConfig('parallel_partial_success_threshold')) as number) ?? 0.5;
  const successCount = aggregateState.results.filter((r: any) => r.status === 'success').length;
  const successRate = successCount / aggregateState.taskCount;

  const overallStatus =
    successRate === 1 ? 'success' : successRate >= threshold ? 'partial' : 'failed';

  emitMetrics([
    METRICS.parallelDispatchCompleted(
      traceId,
      aggregateState.taskCount,
      successCount,
      overallStatus,
      scope
    ),
  ]).catch(() => {});

  const marked = await aggregator.markAsCompleted(userId, traceId, overallStatus, workspaceId);

  if (marked) {
    await emitTypedEvent('events.handler', EventType.PARALLEL_TASK_COMPLETED, {
      userId,
      sessionId: aggregateState.sessionId,
      traceId,
      taskId: traceId,
      initiatorId: aggregateState.initiatorId,
      overallStatus,
      results: aggregateState.results,
      taskCount: aggregateState.taskCount,
      completedCount: aggregateState.results.length,
      elapsedMs: Date.now() - (existingState.createdAt || Date.now()),
      aggregationType: aggregateState.aggregationType,
      aggregationPrompt: aggregateState.aggregationPrompt,
      workspaceId,
      teamId,
      staffId,
    });
  }
}
