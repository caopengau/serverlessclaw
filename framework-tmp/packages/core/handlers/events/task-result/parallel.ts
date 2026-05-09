import { AGENT_TYPES, EventType } from '../../../lib/types/index';
import { AgentRegistry } from '../../../lib/registry/AgentRegistry';

/**
 * Attempts to retry a failed parallel sub-task with an alternative agent.
 * Returns true if a retry was dispatched, false if the failure should be recorded.
 */
export async function handleParallelTaskRetry({
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
}: {
  userId: string;
  traceId: string;
  taskId: string;
  agentId: string;
  response: string;
  existingState: any;
  sessionId?: string;
  depth?: number;
  workspaceId?: string;
  teamId?: string;
  staffId?: string;
}): Promise<boolean> {
  if (!existingState) return false;

  const metadata = existingState.metadata as Record<string, unknown> | undefined;
  const retries = (metadata?.retries as Record<string, number> | undefined) ?? {};
  if (retries[taskId] && retries[taskId] > 0) {
    return false; // Already retried this task once
  }

  // Find the original task definition
  const tasks =
    (metadata?.tasks as
      | Array<{
          taskId: string;
          agentId: string;
          task: string;
          metadata?: Record<string, unknown>;
        }>
      | undefined) ?? [];
  const originalTask = tasks.find((t) => t.taskId === taskId);
  if (!originalTask) return false;

  // Determine alternative agent
  const alternativeAgent = await pickAlternativeAgent(agentId, workspaceId);
  if (!alternativeAgent) return false;

  // Record retry dispatch in aggregator metadata
  const { aggregator } = await import('../../../lib/agent/parallel-aggregator');
  await aggregator.updateProgress(userId, traceId, taskId, 0, 'pending', workspaceId);

  // Emit retry task
  const { emitTypedEvent } = await import('../../../lib/utils/typed-emit');
  await emitTypedEvent('agent.parallel', `${alternativeAgent}_task` as EventType, {
    userId,
    taskId: `${taskId}__retry`,
    task: `[RETRY of ${agentId}] ${originalTask.task}\n\nPrevious failure:\n${response}`,
    metadata: {
      ...originalTask.metadata,
      parallelDispatchId: traceId,
      isRetry: true,
      originalTaskId: taskId,
      originalAgentId: agentId,
    },
    traceId,
    initiatorId: 'parallel-retry-dispatcher',
    depth: (depth ?? 0) + 1,
    sessionId,
    workspaceId,
    teamId,
    staffId,
  });

  // Also update the retry count in the aggregator metadata atomically
  await aggregator.updateProgress(userId, traceId, `${taskId}_retry`, 1, 'pending', workspaceId);

  return true;
}

/**
 * Picks an alternative agent for retrying a failed sub-task.
 */
async function pickAlternativeAgent(
  failedAgentId: string,
  workspaceId?: string
): Promise<string | null> {
  const fallbackChain: Record<string, string[]> = {
    [AGENT_TYPES.CODER]: [AGENT_TYPES.CRITIC, AGENT_TYPES.QA, AGENT_TYPES.RESEARCHER],
    [AGENT_TYPES.CRITIC]: [AGENT_TYPES.QA, AGENT_TYPES.RESEARCHER, AGENT_TYPES.CODER],
    [AGENT_TYPES.QA]: [AGENT_TYPES.RESEARCHER, AGENT_TYPES.CODER, AGENT_TYPES.CRITIC],
    [AGENT_TYPES.RESEARCHER]: [AGENT_TYPES.CODER, AGENT_TYPES.CRITIC, AGENT_TYPES.QA],
    [AGENT_TYPES.FACILITATOR]: [AGENT_TYPES.CRITIC, AGENT_TYPES.QA],
  };

  const candidates = fallbackChain[failedAgentId] ?? [AGENT_TYPES.CODER];

  try {
    for (const candidate of candidates) {
      const config = await AgentRegistry.getAgentConfig(candidate, { workspaceId });
      if (config && config.enabled === true) {
        return candidate;
      }
    }
  } catch {
    // Registry may not be available in all environments
  }

  // Fallback: return first candidate without registry check
  return candidates[0] ?? null;
}
