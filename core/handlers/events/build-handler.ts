import { DynamoMemory } from '../../lib/memory';
import { Agent } from '../../lib/agent';
import { ProviderManager } from '../../lib/providers/index';
import { getAgentTools } from '../../tools/index';
import { EventType, TraceSource, BuildEvent } from '../../lib/types/index';
import { sendOutboundMessage } from '../../lib/outbound';
import { logger } from '../../lib/logger';
import { Context } from 'aws-lambda';
import { emitEvent } from '../../lib/utils/bus';

const memory = new DynamoMemory();
const provider = new ProviderManager();

/**
 * Wake up the initiator agent when a delegated task or system event completes.
 */
export async function wakeupInitiator(
  userId: string,
  initiatorId: string | undefined,
  task: string,
  traceId: string | undefined,
  sessionId: string | undefined,
  depth: number = 0
): Promise<void> {
  if (!initiatorId || !task) return;

  const initiatorAgentId = initiatorId.endsWith('.agent')
    ? initiatorId.replace('.agent', '')
    : initiatorId;

  await emitEvent('events.handler', EventType.CONTINUATION_TASK, {
    userId,
    agentId: initiatorAgentId,
    task,
    traceId,
    initiatorId,
    sessionId,
    depth: depth + 1,
  });
}

/**
 * Handles build failure events - triggers agent to investigate and fix.
 */
export async function handleBuildFailure(
  eventDetail: Record<string, unknown>,
  context: Context
): Promise<void> {
  const {
    userId,
    buildId,
    errorLogs,
    traceId,
    gapIds,
    sessionId,
    initiatorId,
    task: originalTask,
  } = eventDetail as unknown as BuildEvent;

  const gapsContext =
    gapIds && gapIds.length > 0
      ? `This deployment was addressing the following gaps: ${gapIds.join(', ')}.`
      : '';
  const traceContext = traceId
    ? `Refer to the previous reasoning trace for context: ${traceId}`
    : '';

  const task = `CRITICAL: Deployment ${buildId} failed. 
    ${gapsContext}
    ${traceContext}

    Here are the last few lines of the logs:
    ---
    ${errorLogs}
    ---
    Please investigate the codebase using your tools, find the root cause, fix the issue, and trigger a new deployment. 
    Explain your plan to the user before proceeding.`;

  // Process the failure context via the SuperClaw
  const { AgentRegistry } = await import('../../lib/registry');
  const config = await AgentRegistry.getAgentConfig('main');
  if (!config) {
    logger.error('Main agent config missing in events handler');
    return;
  }

  const agentTools = await getAgentTools('events');
  const agent = new Agent(memory, provider, agentTools, config.systemPrompt, config);
  const { responseText, attachments: resultAttachments } = await agent.process(
    userId,
    `SYSTEM_NOTIFICATION: ${task}`,
    {
      context,
      traceId,
      sessionId,
      source: TraceSource.SYSTEM,
    }
  );

  // Notify user via Notifier (if not paused)
  if (!responseText.startsWith('TASK_PAUSED')) {
    await sendOutboundMessage(
      'build-handler',
      userId,
      responseText,
      undefined,
      sessionId,
      'SuperClaw',
      resultAttachments
    );
  }

  // WAKE UP INITIATOR
  if (initiatorId && originalTask) {
    await wakeupInitiator(
      userId,
      initiatorId,
      `BUILD_FAILURE_NOTIFICATION: The deployment for your task "${originalTask}" failed. 
        Error details:
        ---
        ${errorLogs}
        ---
        Please decide on the next course of action.`,
      traceId,
      sessionId
    );
  }
}

/**
 * Handles build success events - notifies user and wakes up initiator.
 */
export async function handleBuildSuccess(eventDetail: Record<string, unknown>): Promise<void> {
  const { userId, buildId, sessionId, initiatorId, task, traceId } =
    eventDetail as unknown as BuildEvent;

  const message = `✅ **DEPLOYMENT SUCCESSFUL**
Build ID: ${buildId}

The build completed successfully. Associated gaps have been marked as **DEPLOYED** and are pending QA verification.
The QA Auditor will verify the changes shortly. Gaps are only marked **DONE** after QA passes (auto mode) or you confirm (HITL mode).`;

  await sendOutboundMessage(
    'build-handler',
    userId,
    message,
    undefined,
    sessionId,
    'SuperClaw',
    undefined
  );

  // WAKE UP INITIATOR
  if (initiatorId && task) {
    await wakeupInitiator(
      userId,
      initiatorId,
      `BUILD_SUCCESS_NOTIFICATION: The deployment for your task "${task}" was successful (Build: ${buildId}). Please perform any post-deployment configuration or verification steps.`,
      traceId,
      sessionId
    );
  }
}
