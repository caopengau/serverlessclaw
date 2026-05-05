import {
  IMemory,
  IProvider,
  ITool,
  MessageRole,
  IAgentConfig,
  TraceSource,
  Attachment,
} from '../../types/index';
import { logger } from '../../logger';
import { AgentProcessOptions } from '../options';
import { AgentEmitter } from '../emitter';
import { DEFAULT_SIGNAL_SCHEMA } from '../schema';
import { AGENT_SYSTEM_IDS, COMMUNICATION_MODES, TRACE_MESSAGES } from '../../constants/agent';

/**
 * Main handler for processing a user request through an agent.
 * Optimized with dynamic imports to minimize static context budget for AI Readiness.
 */
export async function handleProcess(
  agent: {
    memory: IMemory;
    provider: IProvider;
    tools: ITool[];
    config: IAgentConfig;
    emitter: AgentEmitter;
  },
  userId: string,
  userText: string,
  options: AgentProcessOptions = {}
): Promise<{
  responseText: string;
  traceId: string;
  attachments: Attachment[];
  thought: string;
}> {
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
    communicationMode = agent.config.defaultCommunicationMode ||
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
    agentId: agent.config.id,
    isContinuation: !!options.isContinuation,
    userText,
    sessionId,
    hasAttachments: incomingAttachments.length > 0,
    scope,
  });

  const effectiveTaskId = taskId || traceId;
  const nodeId = tracer.getNodeId();
  const parentId = tracer.getParentId();
  const currentInitiator = options.initiatorId || agent.config.id || AGENT_SYSTEM_IDS.ORCHESTRATOR;

  const storageId = isIsolated
    ? `${(agent.config.id || AGENT_SYSTEM_IDS.UNKNOWN).toUpperCase()}#${userId}#${traceId}`
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
      if (identity) {
        userRole = identity.role;
      }

      const hasPermission = await identityManager.hasPermission(
        baseUserId,
        Permission.TASK_CREATE,
        workspaceId
      );
      if (!hasPermission) {
        const errorMsg = `[Agent] Access denied. User ${baseUserId} lacks TASK_CREATE permission.`;
        logger.warn(errorMsg);
        await tracer.failTrace(errorMsg);
        return {
          responseText: `Error: Unauthorized to create tasks`,
          traceId,
          attachments: [],
          thought: '',
        };
      }
    } catch (error) {
      logger.error(`[Agent] Permission check failed:`, error);
      await tracer.failTrace('Permission check failed');
      return {
        responseText: `Error: Permission check failed`,
        traceId,
        attachments: [],
        thought: '',
      };
    }
  }

  const { isBudgetExceeded } = await import('../../recursion-tracker');
  if (await isBudgetExceeded(traceId)) {
    const responseText = TRACE_MESSAGES.BUDGET_EXCEEDED(traceId);
    await tracer.endTrace(responseText);
    return { responseText, traceId, attachments: [], thought: '' };
  }

  const { isHumanTakingControl } = await import('../../handoff');
  const ignoreHandoff = !!options.ignoreHandoff;
  if (!ignoreHandoff && (await isHumanTakingControl(baseUserId, sessionId))) {
    const responseText = TRACE_MESSAGES.OBSERVE_MODE;
    await tracer.endTrace(responseText);
    return { responseText, traceId, attachments: [], thought: '' };
  }

  import('../warmup')
    .then(({ triggerSmartWarmup }) => {
      triggerSmartWarmup(
        userText,
        options.depth || 0,
        sessionId,
        options.sessionStateManager,
        workspaceId
      );
    })
    .catch(() => {});

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
    } = await resolveAgentConfig(agent.config, profile);

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
      agent.config,
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
        systemPrompt: agent.config.systemPrompt || '',
        pageContext: options.pageContext,
        agentId: agent.config.id,
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
      agent.config.id || 'unknown',
      agent.config.name || 'SuperClaw',
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

    const result = await executor.runLoop(messages, {
      maxIterations: agent.config.maxIterations || AGENT_DEFAULTS.MAX_ITERATIONS,
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

    loopUsage.totalInputTokens += result.usage?.totalInputTokens || 0;
    loopUsage.totalOutputTokens += result.usage?.totalOutputTokens || 0;
    loopUsage.total_tokens = loopUsage.totalInputTokens + loopUsage.totalOutputTokens;
    loopUsage.toolCallCount = result.usage?.toolCallCount || 0;
    loopUsage.durationMs = Date.now() - startTime;

    const { responseText: rawResponseText, attachments = [], paused } = result;

    let finalThought = '';
    let responseText = rawResponseText;
    let extractedContent = responseText;
    if (communicationMode === 'json' && rawResponseText) {
      try {
        const parsed = JSON.parse(responseText);
        finalThought = parsed.thought || parsed.reasoning || parsed.thinking || '';
        const extractedText = parsed.message || parsed.plan;
        if (extractedText) {
          responseText = extractedText;
          extractedContent = extractedText;
        }
      } catch {
        // Fallback
      }
    }

    if (!isIsolated) {
      if (result.lastAiResponse) {
        const messageToSave =
          extractedContent !== rawResponseText
            ? { ...result.lastAiResponse, content: extractedContent, thought: finalThought }
            : result.lastAiResponse;
        await agent.memory.addMessage(storageId, messageToSave, scope);
      } else {
        await agent.memory.addMessage(
          storageId,
          {
            role: MessageRole.ASSISTANT,
            content: responseText,
            thought: finalThought,
            agentName: agent.config.name || AGENT_SYSTEM_IDS.SUPERCLAW,
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
    }

    if (!process.env.VITEST) {
      const { reportAgentMetrics } = await import('../metrics-helper');
      await reportAgentMetrics({
        agentId: agent.config.id || AGENT_SYSTEM_IDS.UNKNOWN,
        traceId,
        activeProvider: finalProvider || AGENT_SYSTEM_IDS.UNKNOWN,
        activeModel: finalModel || AGENT_SYSTEM_IDS.UNKNOWN,
        inputTokens: loopUsage.totalInputTokens,
        outputTokens: loopUsage.totalOutputTokens,
        toolCalls: loopUsage.toolCallCount,
        durationMs: loopUsage.durationMs,
        success: !paused,
        paused: !!paused,
        scope,
      });
    }

    await tracer.endTrace(responseText);

    return { responseText, traceId, attachments, thought: finalThought };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[AGENT] Process Error: ${errorMessage}`, { agentId: agent.config.id, traceId });
    await tracer.failTrace(errorMessage, { error: errorMessage });

    if (!process.env.VITEST) {
      const { reportAgentMetrics } = await import('../metrics-helper');
      reportAgentMetrics({
        agentId: agent.config.id || AGENT_SYSTEM_IDS.UNKNOWN,
        traceId,
        activeProvider: AGENT_SYSTEM_IDS.UNKNOWN,
        activeModel: AGENT_SYSTEM_IDS.UNKNOWN,
        inputTokens: 0,
        outputTokens: 0,
        toolCalls: 0,
        durationMs: Date.now() - startTime,
        success: false,
        paused: false,
        scope,
      }).catch(() => {});
    }

    throw error;
  }
}
