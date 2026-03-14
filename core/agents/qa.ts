import { DynamoMemory } from '../lib/memory';
import { Agent } from '../lib/agent';
import { ProviderManager } from '../lib/providers/index';
import { getAgentTools } from '../tools/index';
import {
  ReasoningProfile,
  EventType,
  GapStatus,
  AgentType,
  EvolutionMode,
  SSTResource,
  TraceSource,
} from '../lib/types/index';
import { sendOutboundMessage } from '../lib/outbound';
import { Resource } from 'sst';
import { logger } from '../lib/logger';
import { AgentRegistry } from '../lib/registry';
import { Context } from 'aws-lambda';

const memory = new DynamoMemory();
const provider = new ProviderManager();
const typedResource = Resource as unknown as SSTResource;

export const QA_SYSTEM_PROMPT = `
You are the QA Auditor for Serverless Claw. Your role is to verify that recent code changes actually resolve the identified capability gaps.

Key Obligations:
1. **Validation (MECHANICAL GATING)**: You MUST call at least one system or exploration tool (e.g., 'read_file', 'checkHealth', 'validateCode', 'listFiles') to verify the change before reporting status. You cannot rely on Coder Agent's testimony alone.
2. **Success Criteria**: If the gap is definitively resolved according to your manual checks, set status to "SUCCESS".
3. **Failure Criteria**: If the implementation is missing, buggy, or incomplete, set status to "REOPEN" and explain why.
4. **Safety**: Do not approve changes that introduce obvious security risks or architectural regressions.
5. **Direct Communication**: Use 'sendMessage' to notify the human user immediately of your audit results (Success or Reopen).
6. **User Guidance**: If the feature is deployed and working, but requires user interaction to fully verify (e.g., "try this new command"), explicitly tell the user how to test it in your final message.

OUTPUT FORMAT:
You MUST return your final response as a JSON object with the following schema:
{
  "status": "SUCCESS" | "REOPEN",
  "auditReport": "string (The detailed summary of your verification tests)",
  "reasoning": "string (Why you reached this verdict)"
}
`;

interface QAPayload {
  userId: string;
  gapIds: string[];
  response: string;
  traceId?: string;
  initiatorId?: string;
  depth?: number;
}

interface QAEvent {
  detail?: QAPayload;
  source?: string;
}

/**
 * QA Agent handler. Triggered after a build success or coder task completion.
 *
 * @param event - The EventBridge event containing task and implementation details.
 * @param context - The AWS Lambda context.
 * @returns A promise that resolves when the audit is complete.
 */
export const handler = async (event: QAEvent, _context: Context): Promise<void> => {
  logger.info('QA Agent received verification task:', JSON.stringify(event, null, 2));

  const payload = event.detail || (event as unknown as QAPayload);
  const { userId, gapIds, response: implementationResponse, traceId } = payload;

  if (!userId || !gapIds || !Array.isArray(gapIds) || gapIds.length === 0) {
    logger.warn('QA Auditor received incomplete payload, skipping verification.');
    return;
  }

  // 1. Discovery
  const config = await AgentRegistry.getAgentConfig(AgentType.QA);
  if (!config) {
    logger.error('Failed to load QA configuration');
    return;
  }

  const agentTools = await getAgentTools('qa');
  const qaAgent = new Agent(memory, provider, agentTools, config.systemPrompt, config);

  // IMPORTANT: The Coder's implementation response is provided below only as background context.
  // Do NOT anchor your verdict on the Coder's self-reported success — it may be inaccurate.
  // You MUST independently verify using at least one of: validateCode, read_file, listFiles, checkHealth.
  // Only issue VERIFICATION_SUCCESSFUL after your own mechanical checks confirm the change is live and correct.
  const auditPrompt = `You are auditing the following gaps independently. Do NOT trust the Coder's response alone.

    STEP 1 — MECHANICAL CHECK (mandatory): Call at least one verification tool before forming a verdict:
      - Use 'validateCode' to confirm no type errors were introduced.
      - Use 'read_file' or 'listFiles' to verify the relevant code was actually written/modified.
      - Use 'checkHealth' if the change affects a live endpoint.

    STEP 2 — VERDICT: After your tool checks, respond with VERIFICATION_SUCCESSFUL or REOPEN_REQUIRED.

    Background (Coder's self-report — treat as unverified):
    ${implementationResponse}

    Target Gaps:
    ${gapIds.join(', ')}

    Final response MUST include VERIFICATION_SUCCESSFUL or REOPEN_REQUIRED.`;

  const rawResponse = await qaAgent.process(userId, auditPrompt, {
    profile: ReasoningProfile.THINKING,
    isIsolated: true,
    source: TraceSource.SYSTEM,
    initiatorId: payload.initiatorId,
    depth: payload.depth,
    traceId,
  });

  logger.info('QA Agent Raw Response:', rawResponse);

  let status = 'REOPEN';
  let auditReport = rawResponse;

  try {
    const jsonContent = rawResponse.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(jsonContent);
    status = parsed.status === 'SUCCESS' ? 'SUCCESS' : 'REOPEN';
    auditReport = parsed.auditReport || rawResponse;
    logger.info(`Parsed QA Result. Status: ${status}`);
  } catch (e) {
    logger.warn('Failed to parse QA structured response, falling back to raw text.', e);
  }

  const isSatisfied = status === 'SUCCESS';

  // Resolve evolution mode
  let evolutionMode = EvolutionMode.HITL;
  try {
    const mode = await AgentRegistry.getRawConfig('evolution_mode');
    if (mode === 'auto') evolutionMode = EvolutionMode.AUTO;
  } catch {
    logger.warn('Failed to fetch evolution_mode, defaulting to HITL.');
  }

  if (isSatisfied) {
    if (evolutionMode === EvolutionMode.AUTO) {
      logger.info('Verification successful. Auto-closing gaps.');
      for (const gapId of gapIds) {
        await memory.updateGapStatus(gapId, GapStatus.DONE);
      }
    } else {
      logger.info('Verification successful. Awaiting human confirmation (HITL).');
    }
  } else {
    // Reopen failed verification. Track attempt count and escalate to HITL if cap reached.
    const MAX_REOPEN_ATTEMPTS = 3;
    logger.warn('Verification failed. Checking reopen attempt counts.');
    const escalatedGaps: string[] = [];

    for (const gapId of gapIds) {
      const attempts = await memory.incrementGapAttemptCount(gapId);
      if (attempts >= MAX_REOPEN_ATTEMPTS) {
        logger.warn(
          `Gap ${gapId} has been reopened ${attempts} times. Escalating to HITL and halting autonomous evolution.`
        );
        await memory.updateGapStatus(gapId, GapStatus.OPEN);
        escalatedGaps.push(gapId);
      } else {
        logger.info(`Gap ${gapId} reopen attempt ${attempts}/${MAX_REOPEN_ATTEMPTS}.`);
        await memory.updateGapStatus(gapId, GapStatus.OPEN);
      }
    }

    if (escalatedGaps.length > 0) {
      await AgentRegistry.saveRawConfig('evolution_mode', 'hitl');
      await sendOutboundMessage(
        'qa.agent',
        userId,
        `⚠️ **Evolution Escalation Required**\n\nGaps ${escalatedGaps.join(', ')} have failed QA verification ${MAX_REOPEN_ATTEMPTS} times and cannot be autonomously resolved. Evolution mode has been switched to **HITL**.\n\nPlease review the implementation manually and re-approve when ready.`,
        [userId],
        traceId,
        config.name
      );
    }
  }

  // 1. Notify user directly in the chat session
  await sendOutboundMessage(
    'qa.agent',
    userId,
    `🔍 **QA Audit Complete**\n\n${auditReport}`,
    [userId],
    traceId,
    config.name
  );

  // Universal Coordination: Notify Initiator (if any)
  try {
    const { EventBridgeClient, PutEventsCommand } = await import('@aws-sdk/client-eventbridge');
    const eb = new EventBridgeClient({});
    await eb.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: 'qa.agent',
            DetailType: EventType.TASK_COMPLETED,
            Detail: JSON.stringify({
              userId,
              agentId: AgentType.QA,
              task: `Audit gaps: ${gapIds.join(', ')}`,
              response: auditReport,
              traceId,
              initiatorId: payload.initiatorId,
              depth: payload.depth,
            }),
            EventBusName: typedResource.AgentBus.name,
          },
        ],
      })
    );
  } catch (e) {
    logger.error('Failed to emit TASK_COMPLETED from QA Auditor:', e);
  }
};
