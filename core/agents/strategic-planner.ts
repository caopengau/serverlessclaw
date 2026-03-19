import {
  AgentType,
  ReasoningProfile,
  EvolutionMode,
  GapStatus,
  TraceSource,
} from '../lib/types/index';
import { sendOutboundMessage } from '../lib/outbound';
import { logger } from '../lib/logger';
import { Context } from 'aws-lambda';
import {
  extractPayload,
  loadAgentConfig,
  extractBaseUserId,
  getAgentContext,
  isTaskPaused,
} from '../lib/utils/agent-helpers';
import { emitTaskEvent } from '../lib/utils/agent-helpers/event-emitter';
import { parseStructuredResponse } from '../lib/utils/agent-helpers/llm-utils';
import { parseConfigInt } from '../lib/providers/utils';
import { getEvolutionMode, recordCooldown, isGapInCooldown } from './strategic-planner/evolution';
import {
  buildProactiveReviewPrompt,
  buildReactivePrompt,
  buildTelemetry,
} from './strategic-planner/prompts';
import type { PlannerEvent, PlannerResult, PlannerPayload } from './strategic-planner/types';

/**
 * Planner Agent handler. Analyzes capability gaps and generates strategic plans.
 *
 * @param event - The event containing gap details or scheduling information.
 * @param _context - The AWS Lambda context (unused).
 * @returns A promise that resolves to an object with gapId and the plan, or a status object.
 */
export async function handler(event: PlannerEvent, _context: Context): Promise<PlannerResult> {
  logger.info('Planner Agent received task:', JSON.stringify(event, null, 2));

  // EventBridge wraps the payload in 'detail'
  const payload = extractPayload<PlannerPayload>(event);
  const {
    gapId,
    details,
    contextUserId,
    metadata,
    isScheduledReview,
    traceId,
    initiatorId,
    depth,
    sessionId,
  } = payload;

  const isProactive =
    (metadata as unknown as Record<string, unknown>)?.isProactive || isScheduledReview;

  // Extract base userId (remove CONV# prefix if present)
  const baseUserId = extractBaseUserId(contextUserId);

  // 1. Fetch System Context
  const config = await loadAgentConfig(AgentType.STRATEGIC_PLANNER);
  const { memory, provider: providerManager } = await getAgentContext();

  const { getAgentTools } = await import('../tools/index');
  const agentTools = await getAgentTools('planner');

  // Self-Scheduling: If this is a proactive review, or we are running for any reason,
  // ensure the NEXT proactive review is scheduled if not already present.
  if (isProactive) {
    try {
      const { DynamicScheduler } = await import('../lib/scheduler');
      const { AgentRegistry } = await import('../lib/registry');

      const GOAL_ID = `PLANNER#STRATEGIC_REVIEW#${baseUserId}`;
      const customFreq = await AgentRegistry.getRawConfig('strategic_review_frequency');
      const frequencyHrs = parseConfigInt(customFreq, 24);

      await DynamicScheduler.ensureProactiveGoal({
        goalId: GOAL_ID,
        agentId: AgentType.STRATEGIC_PLANNER,
        task: 'Proactive Strategic Review',
        userId: contextUserId,
        frequencyHrs,
        metadata: { isProactive: true },
      });
    } catch (e) {
      logger.warn('Failed to manage proactive self-scheduling:', e);
    }
  }

  const { Agent } = await import('../lib/agent');
  const plannerAgent = new Agent(memory, providerManager, agentTools, config.systemPrompt, config);
  const toolsList = agentTools
    .map((t: { name: string; description: string }) => `- ${t.name}: ${t.description}`)
    .join('\n    ');
  const telemetry = buildTelemetry(toolsList);

  let plannerPrompt: string;

  if (isProactive) {
    const proactiveResult = await buildProactiveReviewPrompt(
      memory,
      baseUserId,
      telemetry,
      isScheduledReview ?? false
    );

    if (!proactiveResult.shouldRun) {
      return { status: proactiveResult.status };
    }

    plannerPrompt = proactiveResult.prompt;
  } else {
    // Reactionary single gap handling
    plannerPrompt = buildReactivePrompt(payload, telemetry);
  }

  // 2. Self-Evolution Loop Protection (Cool-down)
  if (gapId) {
    const inCooldown = await isGapInCooldown(memory, gapId, baseUserId);
    if (inCooldown) {
      logger.warn(`Evolution cooldown active for gap ${gapId}. Aborting.`);
      return { status: 'COOLDOWN_ACTIVE' };
    }
  }

  // 3. Process with High Reasoning
  const { responseText: rawResponse, attachments: resultAttachments } = await plannerAgent.process(
    contextUserId,
    plannerPrompt,
    {
      profile: ReasoningProfile.DEEP,
      isIsolated: true,
      initiatorId,
      depth,
      traceId,
      sessionId,
      source: TraceSource.SYSTEM,
      communicationMode: 'json',
      responseFormat: {
        type: 'json_schema',
        json_schema: {
          name: 'strategic_plan',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['SUCCESS', 'FAILED'] },
              plan: { type: 'string' },
              coveredGapIds: { type: 'array', items: { type: 'string' } },
            },
            required: ['status', 'plan', 'coveredGapIds'],
            additionalProperties: false,
          },
        },
      },
    }
  );

  logger.info('Strategic Plan Raw Response:', rawResponse);

  let status = 'SUCCESS';
  let plan = rawResponse;
  let coveredGapIds: string[] = [];

  try {
    const parsed = parseStructuredResponse<{
      status: string;
      plan: string;
      coveredGapIds: string[];
    }>(rawResponse);
    status = parsed.status || 'SUCCESS';
    plan = parsed.plan || rawResponse;
    coveredGapIds = parsed.coveredGapIds || [];
    logger.info(`Parsed Strategic Plan. Status: ${status}, Gaps: ${coveredGapIds.join(', ')}`);
  } catch (e) {
    logger.warn('Failed to parse Planner structured response, falling back to raw text.', e);
  }

  // 1. Notify user directly in the chat session
  await sendOutboundMessage(
    'planner.agent',
    contextUserId,
    `🚀 **Strategic Plan Generated**\n\n${plan}`,
    [contextUserId],
    sessionId,
    config.name,
    resultAttachments
  );

  const isFailure = status === 'FAILED' || plan.startsWith('I encountered an internal error');

  // 2. Emit Task Result for Universal Coordination
  if (!isTaskPaused(rawResponse)) {
    await emitTaskEvent({
      source: 'planner.agent',
      userId: contextUserId,
      agentId: AgentType.STRATEGIC_PLANNER,
      task: isScheduledReview ? 'Scheduled Review' : details || 'Strategic Review',
      response: plan,
      error: isFailure ? plan : undefined,
      traceId,
      initiatorId: payload.initiatorId,
      depth: payload.depth,
      sessionId,
    });
  }

  // 4. Record gap in structured cooldown store
  if (gapId && !isFailure) {
    await recordCooldown(memory, gapId, baseUserId);
  }

  // 5. Gap Sink: Mark covered gaps as PLANNED
  const processedGapIds: string[] = [];
  if (!isFailure) {
    if (isScheduledReview) {
      logger.info(`Marking ${coveredGapIds.length} gaps as PLANNED based on structured output.`);
      for (const gId of coveredGapIds) {
        const numericId = gId.replace('GAP#', '');
        await memory.updateGapStatus(numericId, GapStatus.PLANNED);
        processedGapIds.push(numericId);
      }
    } else if (gapId) {
      logger.info(`Marking specific gap ${gapId} as PLANNED after design.`);
      await memory.updateGapStatus(gapId, GapStatus.PLANNED);
      processedGapIds.push(gapId);
    }
  }

  // 6. Save plan for QA auditing
  for (const gapIdToSave of processedGapIds) {
    await memory.updateDistilledMemory(`PLAN#${gapIdToSave}`, plan);
  }

  const evolutionMode = await getEvolutionMode();

  if (evolutionMode === EvolutionMode.AUTO && !isFailure) {
    logger.info('Evolution mode is auto, dispatching CODER_TASK directly.');
    await sendOutboundMessage(
      'planner.agent',
      contextUserId,
      `🚀 **Autonomous Evolution Triggered**\n\nI have identified a capability gap and designed a plan to fix it. The Coder Agent is now executing the following STRATEGIC_PLAN:\n\n${plan}`,
      [contextUserId],
      sessionId,
      config.name,
      undefined
    );

    const { TOOLS } = await import('../tools/index');
    const dispatcher = TOOLS.dispatchTask;
    await dispatcher.execute({
      agentId: AgentType.CODER,
      userId: contextUserId,
      task: plan,
      metadata: {
        gapIds: processedGapIds,
      },
      traceId,
      sessionId,
    });
  } else if (!isFailure) {
    logger.info('Evolution mode is hitl, asking for approval.');
    await sendOutboundMessage(
      'planner.agent',
      contextUserId,
      `🚀 **NEW STRATEGIC PLAN PROPOSED**\n\n${plan}\n\nReply with 'APPROVE' to execute.`,
      [contextUserId],
      sessionId,
      config.name,
      undefined
    );
  }

  return { gapId, plan: plan };
}
