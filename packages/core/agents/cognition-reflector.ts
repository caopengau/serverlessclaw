import { ReasoningProfile } from '../lib/types/llm';
import { AGENT_TYPES, TraceSource } from '../lib/types/agent';
import { logger } from '../lib/logger';
import { Context } from 'aws-lambda';
import { extractPayload } from '../lib/utils/agent-helpers';
import { emitTaskEvent } from '../lib/utils/agent-helpers/event-emitter';
import type { ReflectorEvent } from './cognition-reflector/types';

/**
 * Reflector Agent handler. Analyzes conversations to extract facts, lessons, and capability gaps.
 * Modularized with dynamic imports to minimize static context budget for AI Readiness.
 */
export const handler = async (
  event: ReflectorEvent,
  _context: Context
): Promise<string | undefined> => {
  logger.info('Reflector Agent received task:', JSON.stringify(event, null, 2));

  const payload = extractPayload<ReflectorEvent>(event);
  const { userId, conversation, traceId, sessionId, task, initiatorId, depth, workspaceId } =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload.detail || (payload as any);

  const scope = workspaceId ? { workspaceId } : undefined;

  if (!userId || !conversation) {
    logger.warn('Reflector received incomplete payload, skipping audit.', {
      hasUserId: !!userId,
      hasConversation: !!conversation,
    });
    return;
  }

  const { getAgentContext, loadAgentConfig } = await import('../lib/utils/agent-helpers');
  const { memory, provider } = await getAgentContext();

  try {
    const config = await loadAgentConfig(AGENT_TYPES.COGNITION_REFLECTOR, { workspaceId });
    const isProactiveAudit = task?.includes('SYSTEM_AUDIT') || false;

    // 1. Run full system audit if requested
    if (isProactiveAudit) {
      const { runSystemAudit } = await import('./cognition-reflector/audit-protocol');
      await runSystemAudit(memory as any, 'proactive_audit', { traceId, workspaceId });
    }

    // 2. Build standard reflection prompt
    const { buildReflectionPrompt, getGapContext } = await import('./cognition-reflector/prompts');
    const { deployedGaps, activeGaps } = await getGapContext(memory);

    const systemPrompt = await buildReflectionPrompt(
      memory,
      userId,
      conversation,
      '', // traceContext
      deployedGaps,
      activeGaps
    );

    // 3. Invoke LLM with structured output schema
    const { ReflectionReportSchema } = await import('./cognition-reflector/schema');
    const { parseStructuredResponse } = await import('../lib/utils/agent-helpers/llm-utils');
    const { AgentExecutor } = await import('../lib/agent/executor');
    const { ClawTracer } = await import('../lib/tracer');

    const tracer = new ClawTracer(
      userId,
      TraceSource.SYSTEM,
      traceId,
      undefined,
      undefined,
      AGENT_TYPES.COGNITION_REFLECTOR,
      scope
    );
    await tracer.start();

    const executor = new AgentExecutor(
      provider,
      [],
      AGENT_TYPES.COGNITION_REFLECTOR,
      'CognitionReflector',
      systemPrompt,
      '', // lastSummary
      200000,
      config
    );

    const result = await executor.runLoop([], {
      traceId,
      taskId: `reflect-${Date.now()}`,
      nodeId: tracer.getNodeId(),
      currentInitiator: initiatorId || 'system',
      depth: depth || 0,
      userId,
      userText: 'Analyze this conversation',
      mainConversationId: userId,
      activeModel: config.model || 'unknown',
      activeProvider: config.provider || 'unknown',
      activeProfile: ReasoningProfile.STANDARD,
      tracer,
      responseFormat: {
        type: 'json_schema',
        json_schema: {
          name: 'reflection_report',
          strict: true,
          schema: ReflectionReportSchema as any,
        },
      },
      workspaceId,
    });

    const report = parseStructuredResponse<any>(result.responseText);
    if (!report) {
      throw new Error('Failed to parse reflector structured output');
    }

    // 4. Process and persist the reflection results
    const { processReflectionReport } = await import('./cognition-reflector/processor');
    const summary = await processReflectionReport(userId, report, memory, traceId, workspaceId);

    // 5. Notify completion
    await emitTaskEvent('cognition-reflector', 'TASK_COMPLETED' as any, {
      userId,
      agentId: AGENT_TYPES.COGNITION_REFLECTOR,
      task: task || 'Daily Reflection',
      response: summary,
      traceId,
      sessionId,
      workspaceId,
    });

    await tracer.complete();
    return summary;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[REFLECTOR] Error processing conversation:', error);

    await emitTaskEvent('cognition-reflector', 'TASK_FAILED' as any, {
      userId,
      agentId: AGENT_TYPES.COGNITION_REFLECTOR,
      task: task || 'Daily Reflection',
      error: errorMessage,
      traceId,
      sessionId,
      workspaceId,
    });

    throw error;
  }
};
