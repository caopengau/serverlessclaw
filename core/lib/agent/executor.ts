import { Message, ITool, IProvider, ReasoningProfile, MessageRole, ToolCall } from '../types/index';
import { logger } from '../logger';
import { normalizeProfile } from '../providers/utils';
import { ClawTracer } from '../tracer';
import { LIMITS, TRACE_TYPES } from '../constants';
import { ContextManager } from './context-manager';
import { Context as LambdaContext } from 'aws-lambda';
import { AGENT_DEFAULTS, AGENT_LOG_MESSAGES, LoopResult } from './executor-types';
export { AGENT_DEFAULTS, AGENT_LOG_MESSAGES };
import { ExecutorHelper } from './executor-helper';
import { ToolExecutor } from './tool-executor';

/**
 * Handles the iterative execution loop of an agent.
 * @since 2026-03-19
 */
export class AgentExecutor {
  private lastInjectedMessageTimestamp: number = Date.now();

  constructor(
    private provider: IProvider,
    private tools: ITool[],
    private agentId: string,
    private agentName: string,
    private systemPrompt: string = '',
    private summary: string | null = null,
    private contextLimit: number = LIMITS.MAX_CONTEXT_LENGTH
  ) {}

  async runLoop(
    messages: Message[],
    options: {
      activeModel?: string;
      activeProvider?: string;
      activeProfile: ReasoningProfile;
      maxIterations: number;
      tracer: ClawTracer;
      context?: LambdaContext;
      traceId: string;
      taskId: string;
      nodeId: string;
      parentId: string | undefined;
      currentInitiator: string;
      depth: number;
      sessionId?: string;
      userId: string;
      userText: string;
      mainConversationId: string;
      responseFormat?: import('../types/index').ResponseFormat;
      taskTimeoutMs?: number;
      timeoutBehavior?: 'pause' | 'fail' | 'continue';
      sessionStateManager?: import('../session-state').SessionStateManager;
      approvedToolCalls?: string[];
      isContinuation?: boolean;
    }
  ): Promise<LoopResult> {
    const {
      maxIterations,
      activeModel,
      activeProvider,
      activeProfile,
      tracer,
      context,
      traceId,
      taskId,
      nodeId,
      parentId,
      currentInitiator,
      depth,
      sessionId,
      userId,
      userText,
      mainConversationId,
      responseFormat,
      taskTimeoutMs,
      timeoutBehavior = 'pause',
      sessionStateManager,
      approvedToolCalls,
    } = options;

    let iterations = 0;
    let responseText = '';
    const attachments: NonNullable<Message['attachments']> = [];
    let lastAiResponse: Message | undefined;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let toolCallCount = 0;
    const loopStartTime = Date.now();

    console.log(`[EXECUTOR] Available Tools: ${this.tools.map((t) => t.name).join(', ')}`);

    const globalPauseMsg = await ExecutorHelper.checkGlobalPause();
    if (globalPauseMsg) return { responseText: globalPauseMsg };

    const startTime = Date.now();
    while (iterations < maxIterations) {
      // 0.5. Pending Message Check
      if (sessionStateManager && sessionId) {
        this.lastInjectedMessageTimestamp = await ExecutorHelper.injectPendingMessages(
          messages,
          attachments,
          sessionId,
          this.agentId,
          this.lastInjectedMessageTimestamp,
          sessionStateManager
        );
        await sessionStateManager.renewProcessing(sessionId, this.agentId);
      }

      // 1. Timeout & Cancellation Checks
      const timeoutResult = ExecutorHelper.checkTimeouts(
        startTime,
        taskTimeoutMs,
        timeoutBehavior,
        context
      );
      if (timeoutResult) return { ...timeoutResult, attachments };

      const cancellationMsg = await ExecutorHelper.checkCancellation(taskId);
      if (cancellationMsg) return { responseText: cancellationMsg };

      // 1.5. Context Size Safeguard
      await this.manageContext(messages, activeModel, activeProvider);

      // 2. LLM Call
      await tracer.addStep({
        type: TRACE_TYPES.LLM_CALL,
        content: { messageCount: messages.length, model: activeModel, provider: activeProvider },
      });

      const capabilities = await this.provider.getCapabilities(activeModel);
      const normalizedProfile = normalizeProfile(
        activeProfile,
        capabilities,
        activeModel ?? 'default'
      );
      const aiResponse = await this.provider.call(
        messages,
        this.tools,
        normalizedProfile,
        activeModel,
        activeProvider,
        capabilities.supportsStructuredOutput ? responseFormat : undefined
      );
      lastAiResponse = aiResponse;

      console.log(
        `[EXECUTOR] AI Response: ${aiResponse.content?.substring(0, 50)}... | Tools: ${aiResponse.tool_calls?.length ?? 0}`
      );
      await tracer.addStep({
        type: TRACE_TYPES.LLM_RESPONSE,
        content: {
          content: aiResponse.content,
          tool_calls: aiResponse.tool_calls,
          usage: aiResponse.usage,
        },
      });

      if (aiResponse.usage) {
        totalInputTokens += aiResponse.usage.prompt_tokens;
        totalOutputTokens += aiResponse.usage.completion_tokens;
        this.emitTokenMetrics(aiResponse.usage, activeProvider);
      }

      // 3. Tool Processing
      if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
        messages.push(aiResponse);
        const toolResult = await ToolExecutor.executeToolCalls(
          aiResponse.tool_calls,
          this.tools,
          messages,
          attachments,
          {
            traceId,
            nodeId,
            parentId,
            agentId: this.agentId,
            agentName: this.agentName,
            currentInitiator,
            depth,
            sessionId,
            userId,
            mainConversationId,
            activeModel,
            activeProvider,
            userText,
          },
          tracer,
          approvedToolCalls
        );

        toolCallCount += toolResult.toolCallCount;
        if (toolResult.paused) {
          const isApproval = toolResult.asyncWait && !toolResult.responseText;
          return {
            responseText: isApproval
              ? ExecutorHelper.formatApprovalMessage(
                  this.getPendingToolName(aiResponse, approvedToolCalls),
                  aiResponse.tool_calls[toolResult.toolCallCount].id
                )
              : aiResponse.content ||
                ExecutorHelper.formatUserFriendlyResponse(toolResult.responseText || ''),
            paused: true,
            asyncWait: toolResult.asyncWait,
            pauseMessage: isApproval
              ? `APPROVAL_REQUIRED:${aiResponse.tool_calls[toolResult.toolCallCount].id}`
              : toolResult.responseText,
            attachments,
            tool_calls: aiResponse.tool_calls,
            options: isApproval
              ? [
                  {
                    label: 'Approve Execution',
                    value: `APPROVE_TOOL_CALL:${aiResponse.tool_calls[toolResult.toolCallCount].id}`,
                    type: 'primary',
                  },
                  {
                    label: 'Reject',
                    value: `REJECT_TOOL_CALL:${aiResponse.tool_calls[toolResult.toolCallCount].id}`,
                    type: 'danger',
                  },
                ]
              : undefined,
          };
        }
        iterations++;
      } else {
        responseText = aiResponse.content ?? '';
        break;
      }
    }

    const usage = {
      totalInputTokens,
      totalOutputTokens,
      toolCallCount,
      durationMs: Date.now() - loopStartTime,
    };
    if (!responseText && iterations >= maxIterations) {
      return {
        responseText: AGENT_LOG_MESSAGES.TASK_PAUSED_ITERATION_LIMIT,
        paused: true,
        pauseMessage: AGENT_LOG_MESSAGES.TASK_PAUSED_ITERATION_LIMIT,
        attachments,
        tool_calls: lastAiResponse?.tool_calls,
        usage,
      };
    }

    return {
      responseText: responseText ?? 'Sorry, I reached my iteration limit.',
      attachments: attachments.length > 0 ? attachments : undefined,
      tool_calls: lastAiResponse?.tool_calls,
      usage,
    };
  }

  async *streamLoop(
    messages: Message[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: any // Using any for brevity in this complex refactor, but types are maintained in runLoop
  ): AsyncIterable<import('../types/index').MessageChunk> {
    const {
      maxIterations,
      activeModel,
      activeProvider,
      activeProfile,
      tracer,
      emitter,
      traceId,
      sessionId,
      userId,
      responseFormat,
      approvedToolCalls,
    } = options;
    let iterations = 0;

    while (iterations < maxIterations) {
      const capabilities = await this.provider.getCapabilities(activeModel);
      const normalizedProfile = normalizeProfile(
        activeProfile,
        capabilities,
        activeModel ?? 'default'
      );

      await tracer.addStep({
        type: TRACE_TYPES.LLM_CALL,
        content: { messageCount: messages.length, model: activeModel, provider: activeProvider },
      });

      const stream = this.provider.stream(
        messages,
        this.tools,
        normalizedProfile,
        activeModel,
        activeProvider,
        capabilities.supportsStructuredOutput ? responseFormat : undefined
      );

      let fullContent = '';
      let fullThought = '';
      const toolCalls: ToolCall[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let finalUsage: any;

      for await (const chunk of stream) {
        if (chunk.content) {
          fullContent += chunk.content;
          if (emitter)
            emitter.emitChunk(userId, sessionId, traceId, chunk.content, this.agentName, false);
          yield chunk;
        }
        if (chunk.thought) {
          fullThought += chunk.thought;
          if (emitter)
            emitter.emitChunk(userId, sessionId, traceId, chunk.thought, this.agentName, true);
          yield chunk;
        }
        if (chunk.tool_calls) toolCalls.push(...chunk.tool_calls);
        if (chunk.usage) finalUsage = chunk.usage;
      }

      await tracer.addStep({
        type: TRACE_TYPES.LLM_RESPONSE,
        content: {
          content: fullContent,
          thought: fullThought,
          tool_calls: toolCalls,
          usage: finalUsage,
        },
      });

      if (toolCalls.length === 0) {
        if (finalUsage) yield { usage: finalUsage };
        break;
      }

      // Tool Approval Check for stream
      let approvalRequired = false;
      for (const tc of toolCalls) {
        const tool = this.tools.find((t) => t.name === tc.function.name);
        if (tool?.requiresApproval && !approvedToolCalls?.includes(tc.id)) {
          const approvalMsg = ExecutorHelper.formatApprovalMessage(tool.name, tc.id);
          const opts = [
            { label: 'Approve Execution', value: `APPROVE_TOOL_CALL:${tc.id}`, type: 'primary' },
            { label: 'Reject', value: `REJECT_TOOL_CALL:${tc.id}`, type: 'danger' },
          ];
          if (emitter)
            emitter.emitChunk(
              userId,
              sessionId,
              traceId,
              `\n\n${approvalMsg}`,
              this.agentName,
              false,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              opts as any
            );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          yield { content: `\n\n${approvalMsg}`, options: opts as any };
          approvalRequired = true;
          break;
        }
      }
      if (approvalRequired) break;

      messages.push({
        role: MessageRole.ASSISTANT,
        content: fullContent,
        thought: fullThought,
        tool_calls: toolCalls,
        usage: finalUsage,
      });
      yield { tool_calls: toolCalls };

      const toolResult = await ToolExecutor.executeToolCalls(
        toolCalls,
        this.tools,
        messages,
        [],
        { ...options, agentId: this.agentId, agentName: this.agentName },
        tracer,
        approvedToolCalls
      );
      if (toolResult.paused) break;
      iterations++;
    }
  }

  private async manageContext(messages: Message[], model?: string, provider?: string) {
    const currentTokens = ContextManager.estimateTokens(messages);
    if (currentTokens > this.contextLimit * 0.9 && this.systemPrompt) {
      const rebuilt = await ContextManager.getManagedContext(
        messages,
        this.summary,
        this.systemPrompt,
        this.contextLimit,
        { model, provider }
      );
      messages.length = 0;
      messages.push(...rebuilt.messages);
      logger.warn(`Context truncation: ${currentTokens}→${rebuilt.tokenEstimate} tokens.`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async emitTokenMetrics(usage: any, provider?: string) {
    if (!process.env.VITEST) {
      try {
        const { emitMetrics, Metrics } = await import('../metrics');
        emitMetrics([
          Metrics.tokensInput(usage.prompt_tokens, this.agentId, provider ?? 'unknown'),
          Metrics.tokensOutput(usage.completion_tokens, this.agentId, provider ?? 'unknown'),
        ]).catch(() => {});
      } catch {
        // Ignore metrics errors
      }
    }
  }

  private getPendingToolName(aiResponse: Message, approvedToolCalls?: string[]): string {
    const pending = aiResponse.tool_calls?.find((tc) => !approvedToolCalls?.includes(tc.id));
    return pending?.function.name || 'Unknown Tool';
  }
}
