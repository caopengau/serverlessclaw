import { ToolCall, ITool, Message } from '../types/index';
import { logger } from '../logger';
import { ClawTracer } from '../tracer';
import { executeSingleToolCall } from './executor/tool-execution-logic';

export interface ToolExecutionContext {
  traceId: string;
  nodeId: string;
  parentId?: string;
  agentId: string;
  agentName: string;
  currentInitiator: string;
  depth: number;
  sessionId?: string;
  workspaceId?: string;
  orgId?: string;
  teamId?: string;
  staffId?: string;
  userId: string;
  userRole?: import('../types/agent').UserRole;
  metadata?: Record<string, unknown>;
  mainConversationId: string;
  activeModel?: string;
  activeProvider?: string;
  userText: string;
  agentConfig?: import('../types/index').IAgentConfig;
}

export class ToolExecutor {
  /**
   * Executes a list of tool calls and appends results to messages.
   * Supports parallel execution unless a tool is marked as sequential.
   */
  static async executeToolCalls(
    toolCalls: ToolCall[],
    availableTools: ITool[],
    messages: Message[],
    attachments: NonNullable<Message['attachments']>,
    execContext: ToolExecutionContext,
    tracer: ClawTracer,
    approvedToolCalls?: string[]
  ): Promise<{
    paused?: boolean;
    responseText?: string;
    asyncWait?: boolean;
    toolCallCount: number;
    ui_blocks?: Message['ui_blocks'];
  }> {
    let toolCallCount = 0;
    const ui_blocks: NonNullable<Message['ui_blocks']> = [];

    const enableParallel = execContext.agentConfig?.parallelToolCalls ?? false;
    const toolInfos = toolCalls.map((tc) => {
      const tool = availableTools.find((t) => t.name === tc.function.name);
      return { toolCall: tc, tool };
    });

    const hasSequential = toolInfos.some((ti) => ti.tool?.sequential);

    if (!enableParallel || hasSequential || toolCalls.length <= 1) {
      for (const toolCall of toolCalls) {
        const tool = availableTools.find((t) => t.name === toolCall.function.name);
        const result = await executeSingleToolCall(
          toolCall,
          tool,
          messages,
          attachments,
          execContext,
          tracer,
          approvedToolCalls
        );

        if (result.ui_blocks) ui_blocks.push(...result.ui_blocks);
        if (result.toolCallCount) toolCallCount += result.toolCallCount;

        if (result.paused) {
          return {
            ...result,
            toolCallCount,
            ui_blocks: ui_blocks.length > 0 ? ui_blocks : undefined,
          };
        }
      }
      return { toolCallCount, ui_blocks: ui_blocks.length > 0 ? ui_blocks : undefined };
    }

    logger.info(`[EXECUTOR] Executing ${toolCalls.length} tools in parallel.`);

    const parallelResults = await Promise.all(
      toolCalls.map(async (toolCall) => {
        const tool = availableTools.find((t) => t.name === toolCall.function.name);
        const localMessages: Message[] = [];
        const localAttachments: NonNullable<Message['attachments']> = [];
        const localSteps: any[] = [];

        const result = await executeSingleToolCall(
          toolCall,
          tool,
          localMessages,
          localAttachments,
          execContext,
          tracer,
          approvedToolCalls,
          localSteps
        );

        return { result, localMessages, localAttachments, localSteps };
      })
    );

    const allBatchedSteps: any[] = [];
    for (const res of parallelResults) {
      if (res.result.ui_blocks) ui_blocks.push(...res.result.ui_blocks);
      if (res.result.toolCallCount) toolCallCount += res.result.toolCallCount;

      messages.push(...res.localMessages);
      attachments.push(...res.localAttachments);
      allBatchedSteps.push(...res.localSteps);

      if (res.result.paused) {
        await (tracer as any).batchAddSteps(allBatchedSteps);
        logger.warn(`[EXECUTOR] Parallel execution paused by tool ${res.result.responseText}`);
        return {
          ...res.result,
          toolCallCount,
          ui_blocks: ui_blocks.length > 0 ? ui_blocks : undefined,
        };
      }
    }

    await (tracer as any).batchAddSteps(allBatchedSteps);
    return { toolCallCount, ui_blocks: ui_blocks.length > 0 ? ui_blocks : undefined };
  }
}
