import {
  IMemory,
  IProvider,
  ITool,
  MessageRole,
  IAgentConfig,
  TraceSource,
  Attachment,
  MessageChunk,
} from '../../types/index';
import { logger } from '../../logger';
import { AgentProcessOptions } from '../options';
import { AgentEmitter } from '../emitter';
import { DEFAULT_SIGNAL_SCHEMA } from '../schema';
import { AGENT_SYSTEM_IDS, COMMUNICATION_MODES, TRACE_MESSAGES } from '../../constants/agent';

/**
 * Streaming version of the agent process handler.
 * Optimized with dynamic imports to minimize static context budget.
 */
export async function* handleStream(
  agent: {
    memory: IMemory;
    provider: IProvider;
    tools: ITool[];
    config?: IAgentConfig;
    emitter: AgentEmitter;
  },
  userId: string,
  userText: string,
  options: AgentProcessOptions = {}
): AsyncGenerator<MessageChunk> {
  const {
    isIsolated = false,
    profile,
    traceId: incomingTraceId,
    nodeId: incomingNodeId,
    parentId: incomingParentId,
    taskId,
    sessionId = 'default-session',
    workspaceId,
    orgId,
    teamId,
    staffId,
    userRole: initialUserRole,
    attachments: incomingAttachments = [],
    source = TraceSource.UNKNOWN,
    responseFormat: initialResponseFormat,
    communicationMode = agent.config?.defaultCommunicationMode ||
      (options.initiatorId ? 'json' : 'text'),
    taskTimeoutMs,
    priorTokenUsage,
    skipUserSave = false,
  } = options;

  const responseFormat =
    communicationMode === COMMUNICATION_MODES.JSON
      ? initialResponseFormat || DEFAULT_SIGNAL_SCHEMA
      : initialResponseFormat;

  const scope = { workspaceId, orgId, teamId, staffId };

  const { initializeTracer } = await import('../tracer-init');
  const { tracer, traceId, baseUserId } = await initializeTracer(userId, source, {
    incomingTraceId,
    incomingNodeId,
    incomingParentId,
    agentId: agent.config?.id,
    isContinuation: !!options.isContinuation,
    userText,
    sessionId,
    hasAttachments: incomingAttachments.length > 0,
    scope,
  });

  const effectiveTaskId = taskId || traceId;
  const nodeId = tracer.getNodeId();
  const parentId = tracer.getParentId();
  const currentInitiator = options.initiatorId || agent.config?.id || AGENT_SYSTEM_IDS.ORCHESTRATOR;

  const storageId = isIsolated
    ? `${(agent.config?.id || AGENT_SYSTEM_IDS.UNKNOWN).toUpperCase()}#${userId}#${traceId}`
    : userId;

  let userRole: import('../../../lib/types/agent').UserRole | undefined = initialUserRole;

  const { isE2ETest } = await import('../../utils/agent-helpers');
  if (
    baseUserId &&
    baseUserId !== AGENT_SYSTEM_IDS.SYSTEM &&
    baseUserId !== AGENT_SYSTEM_IDS.DASHBOARD_USER &&
    !isE2ETest()
  ) {
    try {
      const { getIdentityManager, Permission } = await import('../../session/identity');
      const identityManager = await getIdentityManager();
      const identity = await identityManager.getUser(baseUserId);
      if (identity) userRole = identity.role;
      const hasPermission = await identityManager.hasPermission(
        baseUserId,
        Permission.TASK_CREATE,
        workspaceId
      );
      if (!hasPermission) {
        const errorMsg = `[Agent] Access denied. User ${baseUserId} lacks TASK_CREATE permission.`;
        logger.warn(errorMsg);
        await tracer.failTrace(errorMsg);
        yield { content: `Error: Unauthorized to create tasks`, messageId: `err-${Date.now()}` };
        return;
      }
    } catch (error) {
      logger.error(`[Agent] Permission check failed:`, error);
      await tracer.failTrace('Permission check failed');
      yield { content: `Error: Permission check failed`, messageId: `err-${Date.now()}` };
      return;
    }
  }

  const { isBudgetExceeded } = await import('../../recursion-tracker');
  if (await isBudgetExceeded(traceId)) {
    const responseText = TRACE_MESSAGES.BUDGET_EXCEEDED(traceId);
    await tracer.endTrace(responseText);
    yield { content: responseText, messageId: `err-${Date.now()}` };
    return;
  }

  const { isHumanTakingControl } = await import('../../handoff');
  if (!options.ignoreHandoff && (await isHumanTakingControl(baseUserId, sessionId))) {
    const responseText = TRACE_MESSAGES.OBSERVE_MODE;
    await tracer.endTrace(responseText);
    yield { content: responseText, messageId: `err-${Date.now()}` };
    return;
  }

  if (!skipUserSave) {
    await agent.memory.addMessage(
      storageId,
      {
        role: MessageRole.USER,
        content: userText,
        attachments: incomingAttachments as Attachment[],
        traceId,
        messageId: `msg-user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        thought: '',
        workspaceId: workspaceId || 'default',
        tool_calls: [],
        ui_blocks: [],
        agentName: 'Human',
        options: [],
      },
      scope
    );
  }

  const startTime = Date.now();
  try {
    const { resolveAgentConfig } = await import('../config-resolver');
    const {
      activeModel: resolvedModel,
      activeProvider: resolvedProvider,
      activeProfile: resolvedProfile,
    } = await resolveAgentConfig(agent.config || ({} as any), profile);

    const { ConfigManager } = await import('../../registry/config');
    const { CONFIG_KEYS } = await import('../../constants');

    const sessionTokenBudget =
      options.tokenBudget ||
      (await ConfigManager.getTypedConfig<number>(CONFIG_KEYS.SESSION_TOKEN_BUDGET, 0));
    const sessionCostLimit =
      options.costLimit ||
      (await ConfigManager.getTypedConfig<number>(CONFIG_KEYS.SESSION_COST_LIMIT, 0));

    const { AgentAssembler } = await import('../assembler');
    const {
      contextPrompt,
      messages,
      summary,
      contextLimit,
      activeModel: finalModel,
      activeProvider: finalProvider,
    } = await AgentAssembler.prepareContext(
      agent.memory,
      agent.provider,
      agent.config || ({} as any),
      baseUserId,
      storageId,
      userText,
      incomingAttachments as Attachment[],
      {
        isIsolated,
        depth: options.depth || 0,
        activeModel: resolvedModel,
        activeProvider: resolvedProvider,
        activeProfile: resolvedProfile,
        systemPrompt: agent.config?.systemPrompt || '',
        pageContext: options.pageContext,
        agentId: agent.config?.id,
        workspaceId,
        orgId,
        teamId,
        staffId,
      }
    );

    const { AgentExecutor, AGENT_DEFAULTS } = await import('../executor');
    const executor = new AgentExecutor(
      agent.provider,
      agent.tools,
      agent.config?.id || 'unknown',
      agent.config?.name || 'SuperClaw',
      contextPrompt,
      summary,
      contextLimit,
      agent.config
    );

    const loopUsage = {
      totalInputTokens: priorTokenUsage?.inputTokens || 0,
      totalOutputTokens: priorTokenUsage?.outputTokens || 0,
      total_tokens: priorTokenUsage?.totalTokens || 0,
      toolCallCount: 0,
      durationMs: 0,
    };

    const stream = executor.streamLoop(messages, {
      maxIterations: agent.config?.maxIterations || AGENT_DEFAULTS.MAX_ITERATIONS,
      tracer,
      emitter: agent.emitter,
      context: options.context,
      traceId,
      taskId: effectiveTaskId,
      nodeId,
      parentId,
      sessionId,
      workspaceId,
      teamId,
      staffId,
      userId: baseUserId,
      userRole,
      metadata: options.metadata,
      mainConversationId: storageId,
      activeModel: finalModel,
      activeProvider: finalProvider,
      activeProfile: resolvedProfile,
      userText,
      responseFormat,
      taskTimeoutMs,
      approvedToolCalls: options.approvedToolCalls,
      currentInitiator,
      depth: options.depth || 0,
      tokenBudget: sessionTokenBudget || undefined,
      costLimit: sessionCostLimit || undefined,
    });

    let finalResponseText = '';
    let finalThought = '';

    for await (const chunk of stream) {
      if (chunk.content) finalResponseText += chunk.content;
      if (chunk.thought) finalThought += chunk.thought;
      if (chunk.usage) {
        loopUsage.totalInputTokens += chunk.usage.prompt_tokens;
        loopUsage.totalOutputTokens += chunk.usage.completion_tokens;
      }
      yield chunk;
    }

    loopUsage.total_tokens = loopUsage.totalInputTokens + loopUsage.totalOutputTokens;
    loopUsage.durationMs = Date.now() - startTime;

    if (!isIsolated) {
      const { MessageRole } = await import('../../types/llm');
      await agent.memory.addMessage(
        storageId,
        {
          role: MessageRole.ASSISTANT,
          content: finalResponseText,
          thought: finalThought,
          agentName: agent.config?.name || AGENT_SYSTEM_IDS.SUPERCLAW,
          traceId,
          messageId: `msg-assistant-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          workspaceId: workspaceId || 'default',
          attachments: [],
          tool_calls: [],
          options: [],
          ui_blocks: [],
        },
        scope
      );
    }

    if (!process.env.VITEST) {
      const { reportAgentMetrics } = await import('../metrics-helper');
      await reportAgentMetrics({
        agentId: agent.config?.id || AGENT_SYSTEM_IDS.UNKNOWN,
        traceId,
        activeProvider: finalProvider || AGENT_SYSTEM_IDS.UNKNOWN,
        activeModel: finalModel || AGENT_SYSTEM_IDS.UNKNOWN,
        inputTokens: loopUsage.totalInputTokens,
        outputTokens: loopUsage.totalOutputTokens,
        toolCalls: loopUsage.toolCallCount,
        durationMs: loopUsage.durationMs,
        success: true,
        paused: false,
        scope,
      });
    }

    await tracer.endTrace(finalResponseText);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[AGENT] Stream Error: ${errorMessage}`, { agentId: agent.config?.id, traceId });
    await tracer.failTrace(errorMessage, { error: errorMessage });
    yield { content: `Error: ${errorMessage}`, messageId: `err-${Date.now()}` };
  }
}
