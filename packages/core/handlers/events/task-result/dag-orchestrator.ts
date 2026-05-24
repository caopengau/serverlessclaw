import { logger } from '../../../lib/logger';
import { EventType } from '../../../lib/types/agent/events';
import { emitTypedEvent } from '../../../lib/utils/typed-emit';
import { ConfigManager } from '../../../lib/registry/config';
import { emitMetrics, METRICS } from '../../../lib/metrics';
import type { AggregateState } from '../../../lib/agent/parallel-aggregator';

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
  aggregateState: AggregateState,
  existingState: AggregateState,
  scope: { workspaceId?: string; teamId?: string; staffId?: string },
  aggregator: {
    markAsCompleted: (
      userId: string,
      traceId: string,
      status: 'success' | 'partial' | 'failed' | 'timed_out',
      workspaceId?: string
    ) => Promise<boolean>;
  }
): Promise<void> {
  const workspaceId = scope.workspaceId;
  const teamId = scope.teamId;
  const staffId = scope.staffId;

  const threshold =
    ((await ConfigManager.getRawConfig('parallel_partial_success_threshold')) as number) ?? 0.5;
  const results = aggregateState.results || [];
  const successCount = results.filter((r) => r.status === 'success').length;
  const taskCount = aggregateState.taskCount || 0;
  const successRate = taskCount > 0 ? successCount / taskCount : 0;

  const overallStatus =
    successRate === 1 ? 'success' : successRate >= threshold ? 'partial' : 'failed';

  emitMetrics([
    METRICS.parallelDispatchCompleted(
      aggregateState.results_ids[0] || 'unknown', // traceId context
      taskCount,
      successCount,
      overallStatus,
      scope
    ),
  ]).catch(() => {});

  const marked = await aggregator.markAsCompleted(
    aggregateState.userId.split('#')[1], // Original userId (PARALLEL#userId#...)
    aggregateState.results_ids[0] || '', // Use a representative ID or pass traceId explicitly
    overallStatus,
    workspaceId
  );

  if (marked) {
    await emitTypedEvent('events.handler', EventType.PARALLEL_TASK_COMPLETED, {
      userId: aggregateState.userId,
      sessionId: aggregateState.sessionId as string,
      traceId: aggregateState.results_ids[0] || '',
      taskId: aggregateState.results_ids[0] || '',
      initiatorId: aggregateState.initiatorId,
      overallStatus,
      results: aggregateState.results,
      taskCount,
      completedCount: aggregateState.results.length,
      elapsedMs: Date.now() - (existingState.createdAt || Date.now()),
      aggregationType: aggregateState.aggregationType as string,
      aggregationPrompt: aggregateState.aggregationPrompt as string,
      workspaceId,
      teamId,
      staffId,
    });
  }
}
