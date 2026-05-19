import { EventBridgeEvent, Context } from 'aws-lambda';
import { logger } from '../lib/logger';
import { ChatMessageReceivedPayload } from '../lib/schema/events';
import { PluginManager } from '../lib/plugin-manager';
import { bootstrap } from '../lib/bootstrap';
import { emitEvent } from '../lib/utils/bus';
import { EventSource, EventType } from '../lib/types/agent/events';

export const handler = async (
  event: EventBridgeEvent<string, ChatMessageReceivedPayload>,
  context: Context
) => {
  await bootstrap();
  const detail = event.detail;
  logger.info(`[CHAT_ROUTER] Received message from ${detail.userId} via ${detail.platform}`);

  try {
    // 1. Analyze intent or mentions
    // Simple mock logic: look for @agent-name or rely on a default agent
    const text = detail.text.trim();
    let targetAgentId = 'superclaw'; // Default

    // In a real implementation, this would query PluginManager.getRegisteredAgents()
    // or use an LLM router to find the most capable agent.
    const registeredAgents = PluginManager.getRegisteredAgents();

    // Very naive mention matching
    for (const [id, agentConfig] of Object.entries(registeredAgents)) {
      if (text.includes(`@${agentConfig.name}`) || text.includes(`@${id}`)) {
        targetAgentId = id;
        break;
      }
    }

    logger.info(`[CHAT_ROUTER] Routing message to agent: ${targetAgentId}`);

    // 2. Dispatch to the target agent
    // We emit a standard TASK_EVENT or similar that the target agent's multiplexer listens to.
    const taskPayload = {
      traceId: context.awsRequestId,
      userId: detail.userId,
      sessionId: detail.sessionId,
      workspaceId: detail.workspaceId,
      teamId: detail.teamId,
      staffId: detail.staffId,
      task: text,
      metadata: {
        platform: detail.platform,
        originalMessage: text,
        ...detail.metadata,
      },
    };

    // The event type must match what the agent listens to (e.g., `superclaw_task` or dynamic agent types)
    const routingEventType =
      targetAgentId === 'superclaw'
        ? EventType.CODER_TASK // Just as an example, SuperClaw might listen elsewhere, or use a general dispatch
        : `${targetAgentId}_task`;

    await emitEvent(EventSource.ORCHESTRATOR, routingEventType, taskPayload);
  } catch (error) {
    logger.error('[CHAT_ROUTER] Failed to route chat message:', error);
    throw error;
  }
};
