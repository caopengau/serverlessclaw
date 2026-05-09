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

  let args: Record<string, unknown>;
  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch (e) {
    logger.error(`Failed to parse arguments for tool ${toolCall.function.name}:`, e);
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

  if (!tool) {
    logger.info(`Tool ${toolCall.function.name} requested but no local implementation found.`);
    const resultText = 'EXECUTED_BY_PROVIDER';
    const reason = `Tool ${toolCall.function.name} requested but not found in registry.`;

    await recordToolAnalytics(
      toolCall.function.name,
      execContext.agentId,
      false,
      0,
      args,
      resultText,
      execContext,
      reason,
      1.5 // Severity for missing tool
    );

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
    return { toolCallCount: 0 };
  }

  const { ToolSecurityValidator } = await import('../tool-security');
  let securityResult;
  try {
    securityResult = await ToolSecurityValidator.validate(
      tool,
      toolCall,
      args,
      execContext,
      approvedToolCalls
    );
  } catch (securityError) {
    logger.error(`[SECURITY] Validator failed for tool ${tool.name}:`, securityError);
    const errorMsg = securityError instanceof Error ? securityError.message : String(securityError);

    await recordToolAnalytics(
      tool.name,
      execContext.agentId,
      false,
      0,
      args,
      `FAILED: Security validator error - ${errorMsg}`,
      execContext,
      `Security validator failed: ${errorMsg}`,
      5.0 // Max penalty for security system failure
    );

    messages.push({
      role: MessageRole.TOOL,
      tool_call_id: toolCall.id,
      name: toolCall.function.name,
      content: `FAILED: Security validator error (internal security check failure). Execution blocked for safety.`,
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

  if (!securityResult.allowed) {
    if (securityResult.requiresApproval) {
      return {
        asyncWait: true,
        toolCallCount: 0,
        paused: true,
        responseText: securityResult.reason,
      };
    }

    await recordToolAnalytics(
      tool.name,
      execContext.agentId,
      false,
      0,
      args,
      `FAILED: ${securityResult.reason}`,
      execContext,
      `Security block: ${securityResult.reason}`,
      5.0 // Matches test expectation
    );

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
  args.traceId = args.traceId ?? execContext.traceId;
  args.nodeId = args.nodeId ?? execContext.nodeId;
  args.parentId = args.parentId ?? execContext.parentId;
  args.executorAgentId = args.executorAgentId ?? execContext.agentId;
  args.initiatorId = args.initiatorId ?? execContext.currentInitiator;
  args.originalUserTask = args.originalUserTask ?? execContext.userText;

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
    const errorMsg = execError instanceof Error ? execError.message : String(execError);

    await recordToolAnalytics(
      tool.name,
      execContext.agentId,
      false,
      performance.now() - toolStart,
      args,
      `FAILED: Tool execution failed - ${errorMsg}`,
      execContext,
      `Tool ${tool.name} crashed: ${errorMsg}`,
      2.0 // Matches test expectation
    );

    messages.push({
      role: MessageRole.TOOL,
      tool_call_id: toolCall.id,
      name: toolCall.function.name,
      content: `FAILED: Tool execution failed - ${errorMsg}`,
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
