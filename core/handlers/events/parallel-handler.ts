import { EventBridgeEvent } from 'aws-lambda';
import { EventType } from '../../lib/types/agent';
import { logger } from '../../lib/logger';
import { emitEvent } from '../../lib/utils/bus';
import { ParallelDispatchParams } from '../../lib/agent/schema';
import { DynamicScheduler } from '../../lib/scheduler';
import { ConfigManager } from '../../lib/registry/config';

export interface ParallelTaskEvent {
  userId: string;
  sessionId?: string;
  traceId?: string;
  initiatorId?: string;
  depth?: number;
  tasks: ParallelDispatchParams['tasks'];
  barrierTimeoutMs?: number;
  aggregationType?: ParallelDispatchParams['aggregationType'];
  aggregationPrompt?: ParallelDispatchParams['aggregationPrompt'];
}

const DEFAULT_BARRIER_TIMEOUT_MS = 300000;

export async function handleParallelDispatch(
  event: EventBridgeEvent<string, ParallelTaskEvent>
): Promise<void> {
  const {
    userId,
    tasks,
    barrierTimeoutMs,
    traceId,
    initiatorId,
    depth,
    sessionId,
    aggregationType,
    aggregationPrompt,
  } = event.detail;

  const timeoutMs =
    ((await ConfigManager.getRawConfig('parallel_barrier_timeout_ms')) as number) ??
    barrierTimeoutMs ??
    DEFAULT_BARRIER_TIMEOUT_MS;

  logger.info(`Parallel dispatch: ${tasks.length} tasks, timeout=${timeoutMs}ms`);

  if (!tasks || tasks.length === 0) {
    logger.warn('Parallel dispatch received with no tasks');
    return;
  }

  const safeTraceId = traceId ?? `parallel-${Date.now()}`;

  const { aggregator } = await import('../../lib/agent/parallel-aggregator');
  await aggregator.init(
    userId,
    safeTraceId,
    tasks.length,
    initiatorId ?? 'parallel-dispatcher',
    sessionId,
    tasks.map((t) => ({ taskId: t.taskId, agentId: t.agentId })),
    aggregationType,
    aggregationPrompt
  );

  for (const task of tasks) {
    await emitEvent('agent.parallel', `${task.agentId}_task` as EventType, {
      userId,
      taskId: task.taskId,
      task: task.task,
      metadata: { ...task.metadata, parallelDispatchId: safeTraceId },
      traceId: safeTraceId,
      initiatorId: initiatorId ?? 'parallel-dispatcher',
      depth: (depth ?? 0) + 1,
      sessionId,
    });
  }

  const targetTime = Date.now() + timeoutMs;
  const timeoutId = `parallel-barrier-${safeTraceId}-${Date.now()}`;

  try {
    await DynamicScheduler.scheduleOneShotTimeout(
      timeoutId,
      {
        userId,
        traceId: safeTraceId,
        initiatorId: initiatorId ?? 'parallel-dispatcher',
        sessionId,
        depth: depth ?? 0,
        taskCount: tasks.length,
      },
      targetTime,
      EventType.PARALLEL_BARRIER_TIMEOUT
    );
    logger.info(
      `Scheduled parallel barrier timeout for ${timeoutId}: ${new Date(targetTime).toISOString()}`
    );
  } catch (error) {
    logger.warn(`Failed to schedule parallel barrier timeout, proceeding without it:`, error);
  }

  logger.info(
    `Dispatched ${tasks.length} parallel tasks. Aggregation will happen via task-result-handler.`
  );
}
