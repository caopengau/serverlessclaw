import { AGENT_TYPES, UserRole } from '../../lib/types/agent';
import { EventType } from '../../lib/types/agent/events';
import { COMPLETION_EVENT_SCHEMA, FAILURE_EVENT_SCHEMA } from '../../lib/schema/events';
import { wakeupInitiator } from './shared';
import { LRUSet } from '../../lib/utils/lru';
import { getRecursionLimit } from '../../lib/recursion-tracker';
import { routeToDlq } from '../route-to-dlq';
import { emitMetrics, METRICS } from '../../lib/metrics';
import * as crypto from 'crypto';
import { checkAndMarkProcessed } from './task-result/idempotency';
import { handleParallelTaskRetry } from './task-result/parallel';
import { handleDagTaskOutcome, finalizeParallelDispatch } from './task-result/dag-orchestrator';

const DEDUP_MAX_SIZE = 10_000;
const processedEvents = new LRUSet<string>(DEDUP_MAX_SIZE);

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
  } = parsedEvent;
  const response = 'error' in parsedEvent ? parsedEvent.error : parsedEvent.response;

  const recursionLimit = await getRecursionLimit({ isMissionContext: false });
  if ((depth ?? 0) >= recursionLimit) {
    await routeToDlq(event, detailType, 'SYSTEM', traceId ?? 'unknown', `Recursion limit exceeded`);
    emitMetrics([METRICS.dlqEvents(1, { workspaceId, teamId, staffId })]).catch(() => {});
    return;
  }

  // Update reputation (async)
  import('../../lib/memory/base')
    .then(({ BaseMemoryProvider }) => {
      import('../../lib/memory/reputation-operations').then(({ updateReputation }) => {
        const latencyMs = (parsedEvent.metadata as any)?.durationMs ?? 0;
        updateReputation(new BaseMemoryProvider(), agentId, !isFailure, latencyMs, {
          scope: { workspaceId, teamId, staffId },
          traceId: traceId || '',
        });
      });
    })
    .catch(() => {});

  if (
    initiatorId === 'orchestrator' ||
    (agentId === AGENT_TYPES.SUPERCLAW && initiatorId === AGENT_TYPES.SUPERCLAW)
  )
    return;

  if (traceId) {
    const { aggregator } = await import('../../lib/agent/parallel-aggregator');
    const existingState = await aggregator.getState(userId, traceId, workspaceId);

    if (existingState) {
      const taskId = (eventDetail.taskId as string) ?? agentId;
      if (isFailure) {
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
