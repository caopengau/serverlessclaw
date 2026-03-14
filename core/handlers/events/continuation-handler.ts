import { DynamoMemory } from '../../lib/memory';
import { Agent } from '../../lib/agent';
import { ProviderManager } from '../../lib/providers/index';
import { getAgentTools } from '../../tools/index';
import { TraceSource, TaskEvent } from '../../lib/types/index';
import { sendOutboundMessage } from '../../lib/outbound';
import { logger } from '../../lib/logger';
import { Context } from 'aws-lambda';
import { getRecursionLimit, handleRecursionLimitExceeded } from './shared';

const memory = new DynamoMemory();
const provider = new ProviderManager();

/**
 * Handles continuation task events - resumes agent processing with context.
 */
export async function handleContinuationTask(
  eventDetail: Record<string, unknown>,
  context: Context
): Promise<void> {
  const {
    userId,
    agentId,
    task,
    traceId,
    sessionId,
    isContinuation,
    depth,
    initiatorId,
    attachments,
  } = eventDetail as unknown as TaskEvent & { agentId?: string };

  const currentDepth = depth || 1;

  // 1. Loop Protection - Check recursion depth before processing
  const RECURSION_LIMIT = await getRecursionLimit();

  if (currentDepth >= RECURSION_LIMIT) {
    logger.error(
      `Recursion Limit Exceeded for CONTINUATION_TASK (Depth: ${currentDepth}) for user ${userId}. Aborting.`
    );
    await handleRecursionLimitExceeded(
      userId,
      sessionId,
      'continuation-handler',
      `I have detected an infinite loop in task continuation (Depth: ${currentDepth}). I've intervened to stop the process. Please check the orchestration logic.`
    );
    return;
  }

  const targetAgentId = agentId || 'main';
  logger.info(`Handling continuation task for agent ${targetAgentId}, user:`, userId, {
    traceId,
    sessionId,
  });

  const { AgentRegistry } = await import('../../lib/registry');
  const config = await AgentRegistry.getAgentConfig(targetAgentId);
  if (!config) {
    logger.error(`Agent configuration for '${targetAgentId}' not found during continuation.`);
    return;
  }

  const agentTools = await getAgentTools(targetAgentId === 'main' ? 'events' : targetAgentId);
  const agent = new Agent(memory, provider, agentTools, config.systemPrompt, config);

  // Resume with isContinuation = true
  const { responseText, attachments: resultAttachments } = await agent.process(userId, task, {
    context,
    isContinuation: isContinuation !== false, // Default to true for CONTINUATION_TASK
    traceId,
    sessionId,
    depth,
    initiatorId,
    attachments,
    source: TraceSource.SYSTEM,
  });

  if (!responseText.startsWith('TASK_PAUSED')) {
    await sendOutboundMessage(
      'continuation-handler',
      userId,
      responseText,
      undefined,
      sessionId,
      'SuperClaw',
      resultAttachments
    );
  }
}
