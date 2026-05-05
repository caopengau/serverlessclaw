import {
  ToolCall,
  ITool,
  Message,
  MessageRole,
  ToolResult,
  AttachmentType,
  isValidAttachment,
} from '../../types/index';
import { logger } from '../../logger';
import { TRACE_TYPES } from '../../constants';
import { MCP } from '../../constants/tools';
import { isToolExecutionSuccessful, recordToolAnalytics } from './tool-analytics';

/**
 * Logic for executing a single tool call within an agent process.
 */
export async function executeSingleToolCall(
  toolCall: ToolCall,
  tool: ITool | undefined,
  messages: Message[],
  attachments: NonNullable<Message['attachments']>,
  execContext: any,
  tracer: any,
  approvedToolCalls?: string[],
  stepCollector?: any[]
): Promise<{
  paused?: boolean;
  responseText?: string;
  asyncWait?: boolean;
  toolCallCount: number;
  ui_blocks?: Message['ui_blocks'];
}> {
  const addStep = async (step: any) => {
    if (stepCollector) stepCollector.push(step);
    else await tracer.addStep(step);
  };

  if (!tool) {
    logger.info(`Tool ${toolCall.function.name} requested but no local implementation found.`);
    messages.push({
      role: MessageRole.TOOL,
      tool_call_id: toolCall.id,
      name: toolCall.function.name,
      content: 'EXECUTED_BY_PROVIDER',
      traceId: execContext.traceId,
      messageId: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      workspaceId: execContext.workspaceId,
      attachments: [],
      options: [],
      ui_blocks: [],
      thought: '',
      agentName: 'SYSTEM',
    });
    return { toolCallCount: 0 };
  }

  let args: Record<string, unknown>;
  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch (e) {
    logger.error(`Failed to parse arguments for tool ${tool.name}:`, e);
    messages.push({
      role: MessageRole.TOOL,
      tool_call_id: toolCall.id,
      name: toolCall.function.name,
      content: `FAILED: Malformed JSON arguments.`,
      traceId: execContext.traceId,
      messageId: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      workspaceId: execContext.workspaceId,
      attachments: [],
      options: [],
      ui_blocks: [],
      thought: '',
      agentName: 'SYSTEM',
    });
    return { toolCallCount: 0 };
  }

  const { ToolSecurityValidator } = await import('../tool-security');
  const securityResult = await ToolSecurityValidator.validate(
    tool,
    toolCall,
    args,
    execContext,
    approvedToolCalls
  );

  if (!securityResult.allowed) {
    if (securityResult.requiresApproval) {
      return {
        asyncWait: true,
        toolCallCount: 0,
        paused: true,
        responseText: securityResult.reason,
      };
    }
    messages.push({
      role: MessageRole.TOOL,
      tool_call_id: toolCall.id,
      name: toolCall.function.name,
      content: `FAILED: ${securityResult.reason}`,
      traceId: execContext.traceId,
      messageId: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      workspaceId: execContext.workspaceId,
      attachments: [],
      options: [],
      ui_blocks: [],
      thought: '',
      agentName: 'SYSTEM',
    });
    return { toolCallCount: 0 };
  }

  if (securityResult.modifiedArgs) args = securityResult.modifiedArgs;

  // Add context args
  args.userId = args.userId ?? execContext.userId;
  args.sessionId = args.sessionId ?? execContext.sessionId;
  args.workspaceId = args.workspaceId ?? execContext.workspaceId;

  if (tool.argSchema) {
    try {
      args = tool.argSchema.parse(args) as Record<string, unknown>;
    } catch (schemaError) {
      logger.error(`Argument validation failed for tool ${tool.name}:`, schemaError);
      messages.push({
        role: MessageRole.TOOL,
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: `FAILED: Argument validation error: ${schemaError instanceof Error ? schemaError.message : String(schemaError)}`,
        traceId: execContext.traceId,
        messageId: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        workspaceId: execContext.workspaceId,
        attachments: [],
        options: [],
        ui_blocks: [],
        thought: '',
        agentName: 'SYSTEM',
      });
      return { toolCallCount: 0 };
    }
  }

  await addStep({ type: TRACE_TYPES.TOOL_CALL, content: { toolName: tool.name, args } });

  const toolStart = performance.now();
  const timeoutMs = parseInt(
    process.env.TOOL_EXECUTION_TIMEOUT_MS ?? String(MCP.TOOL_EXECUTION_TIMEOUT_MS)
  );
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Tool execution timeout after ${timeoutMs}ms`)), timeoutMs);
  });

  let rawResult: ToolResult | string;
  try {
    rawResult = await Promise.race([tool.execute(args), timeoutPromise]);
  } catch (execError) {
    logger.error(`[EXECUTOR] Tool ${tool.name} failed:`, execError);
    messages.push({
      role: MessageRole.TOOL,
      tool_call_id: toolCall.id,
      name: toolCall.function.name,
      content: `FAILED: Tool execution failed - ${execError instanceof Error ? execError.message : String(execError)}`,
      traceId: execContext.traceId,
      messageId: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      workspaceId: execContext.workspaceId,
      attachments: [],
      options: [],
      ui_blocks: [],
      thought: '',
      agentName: 'SYSTEM',
    });
    return { toolCallCount: 0 };
  }

  const durationMs = performance.now() - toolStart;
  const resultText =
    typeof rawResult === 'string'
      ? rawResult
      : (rawResult as ToolResult).text || JSON.stringify(rawResult) || '';
  const success = isToolExecutionSuccessful(rawResult, resultText);

  await recordToolAnalytics(
    tool.name,
    execContext.agentId,
    success,
    durationMs,
    args,
    resultText,
    execContext
  );

  const ui_blocks: Message['ui_blocks'] = [];
  if (typeof rawResult !== 'string') {
    const res = rawResult as ToolResult;
    if (res.images)
      res.images.forEach((img) => attachments.push({ type: AttachmentType.IMAGE, base64: img }));
    if (res.ui_blocks) ui_blocks.push(...res.ui_blocks);
    if (res.metadata?.attachments && Array.isArray(res.metadata.attachments)) {
      res.metadata.attachments.forEach((rawAtt) => {
        if (isValidAttachment(rawAtt)) attachments.push(rawAtt as any);
      });
    }
  }

  await addStep({
    type: TRACE_TYPES.TOOL_RESULT,
    content: { toolName: tool.name, result: rawResult },
  });

  messages.push({
    role: MessageRole.TOOL,
    tool_call_id: toolCall.id,
    name: toolCall.function.name,
    content: resultText,
    traceId: execContext.traceId,
    messageId: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    workspaceId: execContext.workspaceId,
    attachments: [],
    options: [],
    ui_blocks: [],
    thought: '',
    agentName: 'SYSTEM',
  });

  return {
    toolCallCount: 1,
    paused: resultText.startsWith('TASK_PAUSED'),
    asyncWait: resultText.startsWith('TASK_PAUSED'),
    responseText: resultText.startsWith('TASK_PAUSED') ? resultText : undefined,
    ui_blocks: ui_blocks.length > 0 ? ui_blocks : undefined,
  };
}
