import { logger } from '../../lib/logger';
import { AGENT_TYPES, EventType } from '../../lib/types/agent';
import { PARALLEL_TASK_COMPLETED_EVENT_SCHEMA } from '../../lib/schema/events';
import { ReasoningProfile, TraceSource } from '../../lib/types/llm';

/**
 * Event handler for when all sub-tasks in a parallel dispatch are completed.
 * It aggregates results and wakes up the initiator.
 * Optimized with dynamic imports to minimize static context budget.
 */
export async function handleParallelTaskCompleted(
  eventDetail: Record<string, unknown>
): Promise<void> {
  const payload = PARALLEL_TASK_COMPLETED_EVENT_SCHEMA.parse(eventDetail);
  const {
    userId,
    traceId,
    initiatorId,
    sessionId,
    depth,
    results,
    aggregationPrompt,
    aggregationType,
    workspaceId,
    teamId,
    staffId,
    userRole,
  } = payload;

  logger.info(`[PARALLEL] All sub-tasks completed for trace ${traceId}. Aggregating results.`);

  const { wakeupInitiator } = await import('./shared');

  // 1. Specialized Aggregation: Procedural Patch Merge (Principle 10 & 11)
  if (aggregationType === 'merge_patches') {
    try {
      const { handlePatchMerge } = await import('./merger-handler');
      const mergeResult = await handlePatchMerge(payload as unknown as Record<string, unknown>);

      if (mergeResult.success || !mergeResult.failedPatches?.length) {
        logger.info(`[PARALLEL] Patch merge complete for ${traceId}.`);
        if (initiatorId) {
          await wakeupInitiator(
            userId,
            initiatorId,
            mergeResult.summary,
            traceId,
            sessionId,
            depth,
            false,
            undefined,
            traceId,
            EventType.CONTINUATION_TASK as any,
            workspaceId,
            teamId,
            staffId,
            userRole as any
          );
        }
        return;
      }
      logger.warn(
        `[PARALLEL] Patch merge had failures for ${traceId}. Falling back to standard aggregation.`
      );
    } catch (e) {
      logger.error(`[PARALLEL] Patch merge handler failed:`, e);
    }
  }

  // 2. Default Aggregation: LLM-based Summary
  const { getAgentContext } = await import('../../lib/utils/agent-helpers');
  const { memory, provider } = await getAgentContext();

  const resultsSummary = results
    .map(
      (r: { agentId: string; taskId: string; result: string }) =>
        `### AGENT: ${r.agentId} (Task: ${r.taskId})\n\nRESULT:\n${r.result}`
    )
    .join('\n\n---\n\n');

  const finalPrompt =
    aggregationPrompt ||
    `Below are results from multiple sub-agents that worked on parts of your request. ` +
      `Please synthesize them into a single coherent response.\n\n` +
      `SUB-AGENT RESULTS:\n\n${resultsSummary}`;

  if (initiatorId === AGENT_TYPES.SUPERCLAW) {
    const { SuperClaw } = await import('../../agents/superclaw');
    const agent = new SuperClaw(memory, provider, []);
    await agent.process(userId, finalPrompt, {
      traceId,
      sessionId,
      depth,
      workspaceId,
      orgId: payload.orgId,
      teamId,
      staffId,
      userRole: userRole as any,
      source: TraceSource.SWARM,
      profile: ReasoningProfile.STANDARD,
    });
  } else if (initiatorId) {
    await wakeupInitiator(
      userId,
      initiatorId,
      `PARALLEL_COMPLETED: Synthesis required for the following sub-task results:\n\n${resultsSummary}`,
      traceId,
      sessionId,
      depth,
      false,
      undefined,
      traceId,
      EventType.CONTINUATION_TASK as any,
      workspaceId,
      teamId,
      staffId,
      userRole as any
    );
  }

  const { clearRecursionStack } = await import('../../lib/recursion-tracker');
  await clearRecursionStack(traceId);
}
