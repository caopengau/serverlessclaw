import { AgentType, EventType } from '../lib/types/agent';
import { logger } from '../lib/logger';
import { Context } from 'aws-lambda';
import { handleWarmup } from '../lib/utils/agent-helpers';

/**
 * Agent Multiplexer (Mono-lambda).
 * Routes incoming EventBridge tasks to the specialized agent logic.
 * Consolidated into a single high-performance Lambda to reduce cold-start latency.
 */
export const handler = async (
  event: Record<string, unknown>,
  context: Context
): Promise<unknown> => {
  const detailType = (event['detail-type'] as string) || (event.type as string);

  // 1. Handle Centralized Warmup
  // If no specific agent is targeted, we warm the core cognitive suite.
  if (await handleWarmup(event, 'brain')) {
    // Record warm state in DynamoDB to complete the smart warmup loop
    const tier = process.env.MULTIPLEXER_TIER;
    if (tier) {
      try {
        const { WarmupManager } = await import('../lib/warmup');
        const warmupManager = new WarmupManager({ servers: {}, agents: {}, ttlSeconds: 900 });
        await warmupManager.recordWarmState({
          server: tier,
          lastWarmed: new Date().toISOString(),
          warmedBy: 'webhook',
          ttl: Math.floor(Date.now() / 1000) + 900,
        });
      } catch (e) {
        logger.warn(`[MULTIPLEXER] Failed to record warm state for ${tier}:`, e);
      }
    }
    logger.info(`[MULTIPLEXER] ${tier ? tier.toUpperCase() : 'Suite'} warmed and ready.`);
    return 'WARM';
  }

  logger.info(`[MULTIPLEXER] Received ${detailType}`, { requestId: context.awsRequestId });

  // 2. Identify Target Agent
  let targetAgent: AgentType | undefined;
  let handlerPath: string | undefined;

  switch (detailType) {
    case EventType.CODER_TASK:
      targetAgent = AgentType.CODER;
      handlerPath = '../agents/coder';
      break;
    case EventType.RESEARCH_TASK:
      targetAgent = AgentType.RESEARCHER;
      handlerPath = '../agents/researcher';
      break;
    case EventType.CRITIC_TASK:
    case 'critic_task':
      targetAgent = AgentType.CRITIC;
      handlerPath = '../agents/critic';
      break;
    case 'facilitator_task':
      targetAgent = AgentType.FACILITATOR;
      handlerPath = '../agents/facilitator';
      break;
    case EventType.MERGER_TASK:
      targetAgent = AgentType.MERGER;
      handlerPath = '../agents/merger';
      break;
    case 'qa_task':
    case EventType.CODER_TASK_COMPLETED: // QA often triggers on coder completion
    case EventType.SYSTEM_BUILD_SUCCESS: // QA also triggers on build success
      targetAgent = AgentType.QA;
      handlerPath = '../agents/qa';
      break;
    case EventType.EVOLUTION_PLAN:
    case 'strategic-planner_task':
      targetAgent = AgentType.STRATEGIC_PLANNER;
      handlerPath = '../agents/strategic-planner';
      break;
    case EventType.REFLECT_TASK:
    case 'cognition-reflector_task':
      targetAgent = AgentType.COGNITION_REFLECTOR;
      handlerPath = '../agents/cognition-reflector';
      break;
    default:
      // Check if it's a dynamic agent or explicitly specified in the payload
      targetAgent = (event.detail as Record<string, unknown>)?.agentId as AgentType;
      if (targetAgent) {
        // Dynamic agents are still handled by Agent Runner usually,
        // but the multiplexer could potentially handle them if imported.
        // For now, we fall back to manual routing or error.
      }
  }

  if (!targetAgent || !handlerPath) {
    logger.warn(
      `[MULTIPLEXER] No specific agent routing for ${detailType}. Passing to Event Handler if applicable.`
    );
    return;
  }

  try {
    // 3. Dispatch to Agent Logic
    logger.info(`[MULTIPLEXER] Dispatching to ${targetAgent}...`);
    const agentModule = await import(handlerPath);

    if (typeof agentModule.handler === 'function') {
      return await agentModule.handler(event, context);
    } else {
      throw new Error(`Agent ${targetAgent} does not export a valid handler function.`);
    }
  } catch (error) {
    logger.error(`[MULTIPLEXER] Failed to execute agent ${targetAgent}:`, error);
    throw error;
  }
};
