import { AGENT_TYPES, UserRole } from '../../lib/types/agent';
import { EventType } from '../../lib/types/agent/events';
import { COMPLETION_EVENT_SCHEMA, FAILURE_EVENT_SCHEMA } from '../../lib/schema/events';
import { LRUSet } from '../../lib/utils/lru';
import * as crypto from 'crypto';
import { checkAndMarkProcessed } from './task-result/idempotency';
import { recordTaskReputation } from './task-result/reputation';

const DEDUP_MAX_SIZE = 10_000;
const processedEvents = new LRUSet<string>(DEDUP_MAX_SIZE);

/**
 * Handles the result of a delegated task (completion or failure).
 * Orchestrates parallel aggregation, DAG updates, or initiator wakeup.
 */
export async function handleTaskResult(
  event: { 'detail-type': string; detail: Record<string, unknown>; id?: string },
  detailType: string
): Promise<void> {
  const eventDetail = event.detail;
  const workspaceId = (eventDetail.workspaceId as string) || undefined;

  const stablePayload = { ...eventDetail };
  delete (stablePayload as Record<string, unknown>).__envelopeId;
  const contentHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(stablePayload) + detailType)
    .digest('hex')
    .substring(0, 16);

  const idempotencyKey =
    (eventDetail.idempotencyKey as string) ||
    (eventDetail.__envelopeId as string) ||
    (event.id as string) ||
    contentHash;

  if (processedEvents.has(idempotencyKey)) return;
  processedEvents.add(idempotencyKey);

  const isFirstProcessing = await checkAndMarkProcessed(idempotencyKey, workspaceId);
  if (!isFirstProcessing) return;

  const isFailure = detailType === EventType.TASK_FAILED;
  const parsedEvent = isFailure
    ? FAILURE_EVENT_SCHEMA.parse(eventDetail)
    : COMPLETION_EVENT_SCHEMA.parse(eventDetail);

  const {
    userId,
    agentId,
    traceId,
    initiatorId,
    depth,
    sessionId,
    userNotified,
    teamId,
    staffId,
    userRole,
    taskId,
  } = parsedEvent;
  const response = 'error' in parsedEvent ? parsedEvent.error : parsedEvent.response;

  const { getRecursionLimit } = await import('../../lib/recursion-tracker');
  const recursionLimit = await getRecursionLimit({ isMissionContext: false });
  if (depth >= recursionLimit) {
    const { routeToDlq } = await import('../route-to-dlq');
    const { emitMetrics, METRICS } = await import('../../lib/metrics');
    await routeToDlq(event, detailType, 'SYSTEM', traceId, `Recursion limit exceeded`);
    emitMetrics([METRICS.dlqEvents(1, { workspaceId, teamId, staffId })]).catch(() => {});
    return;
  }

  // Update reputation (background)
  recordTaskReputation({
    agentId,
    isSuccess: !isFailure,
    metadata: parsedEvent.metadata as Record<string, unknown>,
    workspaceId,
    teamId,
    staffId,
    traceId,
  }).catch(() => {});

  if (
    initiatorId === 'orchestrator' ||
    (agentId === AGENT_TYPES.SUPERCLAW && initiatorId === AGENT_TYPES.SUPERCLAW)
  )
    return;

  if (traceId) {
    const { aggregator } = await import('../../lib/agent/parallel-aggregator');
    const existingState = await aggregator.getState(userId, traceId, workspaceId);

    if (existingState) {
      if (isFailure) {
        const { handleParallelTaskRetry } = await import('./task-result/parallel');
        const retryDispatched = await handleParallelTaskRetry({
          userId,
          traceId,
          taskId,
          agentId,
          response,
          existingState,
          sessionId,
          depth,
          workspaceId,
          teamId,
          staffId,
        });
        if (retryDispatched) return;
      }

      const aggregateState = await aggregator.addResult(
        userId,
        traceId,
        {
          taskId,
          agentId,
          status: isFailure ? 'failed' : 'success',
          result: response,
          durationMs: 0,
          patch: (eventDetail.metadata as any)?.patch,
        },
        workspaceId
      );

      if ((existingState.metadata as any)?.hasDependencies) {
        const { handleDagTaskOutcome } = await import('./task-result/dag-orchestrator');
        await handleDagTaskOutcome(
          {
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
          },
          isFailure
        );
        return;
      }

      if (aggregateState?.isComplete) {
        const { finalizeParallelDispatch } = await import('./task-result/dag-orchestrator');
        await finalizeParallelDispatch(
          aggregateState,
          existingState,
          { workspaceId, teamId, staffId },
          aggregator
        );
      }
      return;
    }
  }

  const resultPrefix = isFailure ? 'DELEGATED_TASK_FAILURE' : 'DELEGATED_TASK_RESULT';
  const { wakeupInitiator } = await import('./shared');
  await wakeupInitiator(
    userId,
    initiatorId,
    `${resultPrefix}: Agent '${agentId}' has ${isFailure ? 'failed' : 'completed'} the task. Result: ${response}`,
    traceId,
    sessionId,
    depth,
    userNotified,
    undefined,
    traceId,
    EventType.CONTINUATION_TASK as any,
    workspaceId,
    teamId,
    staffId,
    userRole as UserRole
  );
}
