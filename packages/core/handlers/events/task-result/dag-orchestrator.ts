import { logger } from '../../../lib/logger';
import { EventType } from '../../../lib/types/agent/events';
import { emitTypedEvent } from '../../../lib/utils/typed-emit';
import { ConfigManager } from '../../../lib/registry/config';
import { emitMetrics, METRICS } from '../../../lib/metrics';

/**
 * Handles DAG task completion/failure and triggers the next step.
 */
export async function handleDagTaskOutcome(
  payload: Record<string, unknown>,
  isFailure: boolean
): Promise<void> {
  const userId = payload.userId as string;
  const traceId = payload.traceId as string;
  const taskId = payload.taskId as string;
  const agentId = payload.agentId as string;
  const response = payload.response;
  const sessionId = payload.sessionId as string;
  const depth = payload.depth as number;
  const workspaceId = payload.workspaceId as string | undefined;
  const teamId = payload.teamId as string | undefined;
  const staffId = payload.staffId as string | undefined;
  const userRole = payload.userRole as string | undefined;

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
  aggregateState: Record<string, unknown>,
  existingState: Record<string, unknown>,
  scope: { workspaceId?: string; teamId?: string; staffId?: string },
  aggregator: {
    markAsCompleted: (
      userId: string,
      traceId: string,
      status: string,
      workspaceId?: string
    ) => Promise<boolean>;
  }
): Promise<void> {
  const userId = aggregateState.userId as string;
  const traceId = aggregateState.traceId as string;
  const workspaceId = aggregateState.workspaceId as string | undefined;
  const teamId = aggregateState.teamId as string | undefined;
  const staffId = aggregateState.staffId as string | undefined;

  const threshold =
    ((await ConfigManager.getRawConfig('parallel_partial_success_threshold')) as number) ?? 0.5;
  const results = (aggregateState.results as Array<Record<string, unknown>>) || [];
  const successCount = results.filter((r) => r.status === 'success').length;
  const taskCount = (aggregateState.taskCount as number) || 0;
  const successRate = taskCount > 0 ? successCount / taskCount : 0;

  const overallStatus =
    successRate === 1 ? 'success' : successRate >= threshold ? 'partial' : 'failed';

  emitMetrics([
    METRICS.parallelDispatchCompleted(traceId, taskCount, successCount, overallStatus, scope),
  ]).catch(() => {});

  const marked = await aggregator.markAsCompleted(userId, traceId, overallStatus, workspaceId);

  if (marked) {
    const resultsArray = (aggregateState.results as unknown[]) || [];
    await emitTypedEvent('events.handler', EventType.PARALLEL_TASK_COMPLETED, {
      userId,
      sessionId: aggregateState.sessionId as string,
      traceId,
      taskId: traceId,
      initiatorId: aggregateState.initiatorId as string,
      overallStatus,
      results: resultsArray,
      taskCount,
      completedCount: resultsArray.length,
      elapsedMs: Date.now() - ((existingState.createdAt as number) || Date.now()),
      aggregationType: aggregateState.aggregationType as string,
      aggregationPrompt: aggregateState.aggregationPrompt as string,
      workspaceId,
      teamId,
      staffId,
    });
  }
}
