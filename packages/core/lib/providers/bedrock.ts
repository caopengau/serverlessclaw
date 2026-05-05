import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  Message as BedrockMessage,
  SystemContentBlock,
  Tool as BedrockTool,
  ConverseStreamOutput,
} from '@aws-sdk/client-bedrock-runtime';
import {
  IProvider,
  Message,
  ITool,
  ReasoningProfile,
  AttachmentType,
  MessageRole,
  BedrockModel,
  MessageChunk,
  ResponseFormat,
} from '../types/index';
import { logger } from '../logger';
import { normalizeProfile } from './utils';
import { convertToBedrockMessage, BEDROCK_CONSTANTS } from './bedrock/message-converter';

const DEFAULT_TOP_P = 0.9;
const DEFAULT_CONTEXT_WINDOW = 200000;
const CLAUDE_46_MODELS = ['claude-sonnet-4-6', 'claude-4-6', 'claude-v4.6'];
const COMPUTER_USE_OPTIONS = { display_height: 768, display_width: 1024, display_number: 0 };

const BEDROCK_REASONING_MAP: Record<
  ReasoningProfile,
  { thinkingBudget: number; thinkingEnabled: boolean; maxTokens: number; temperature: number }
> = {
  [ReasoningProfile.FAST]: {
    thinkingBudget: 0,
    thinkingEnabled: false,
    maxTokens: 4096,
    temperature: 0.7,
  },
  [ReasoningProfile.STANDARD]: {
    thinkingBudget: 512,
    thinkingEnabled: true,
    maxTokens: 8192,
    temperature: 0.7,
  },
  [ReasoningProfile.THINKING]: {
    thinkingBudget: 2048,
    thinkingEnabled: true,
    maxTokens: 12288,
    temperature: 1.0,
  },
  [ReasoningProfile.DEEP]: {
    thinkingBudget: 8192,
    thinkingEnabled: true,
    maxTokens: 16384,
    temperature: 1.0,
  },
};

/**
 * Provider for AWS Bedrock LLM services.
 */
export class BedrockProvider implements IProvider {
  private static _client: BedrockRuntimeClient | null = null;
  private static _currentRegion: string | null = null;

  constructor(private modelId: string = BedrockModel.CLAUDE_4_6) {}

  private get client(): BedrockRuntimeClient {
    const region = process.env.AWS_REGION || 'us-east-1';
    if (!BedrockProvider._client || BedrockProvider._currentRegion !== region) {
      BedrockProvider._client = new BedrockRuntimeClient({ region });
      BedrockProvider._currentRegion = region;
    }
    return BedrockProvider._client;
  }

  async call(
    messages: Message[],
    tools?: ITool[],
    profile: ReasoningProfile = ReasoningProfile.STANDARD,
    model?: string,
    _provider?: string,
    responseFormat?: ResponseFormat,
    temperature?: number,
    maxTokens?: number,
    topP?: number,
    stopSequences?: string[]
  ): Promise<Message> {
    const client = this.client;
    const activeModelId = model ?? this.modelId;

    const capabilities = await this.getCapabilities(activeModelId);
    profile = normalizeProfile(profile, capabilities, activeModelId);

    const config = BEDROCK_REASONING_MAP[profile];

    const bedrockMessages: BedrockMessage[] = messages
      .filter((m) => m.role !== MessageRole.SYSTEM && m.role !== MessageRole.DEVELOPER)
      .map(convertToBedrockMessage);

    const system: SystemContentBlock[] = messages
      .filter((m) => m.role === MessageRole.SYSTEM || m.role === MessageRole.DEVELOPER)
      .map((m) => ({ text: m.content || '' }));

    const bedrockTools: BedrockTool[] | undefined = tools
      ?.filter(
        (t) =>
          !t.type ||
          t.type === BEDROCK_CONSTANTS.TOOL_TYPES.FUNCTION ||
          t.type === BEDROCK_CONSTANTS.TOOL_TYPES.COMPUTER_USE
      )
      .map((tool) => {
        if (tool.type === BEDROCK_CONSTANTS.TOOL_TYPES.COMPUTER_USE) {
          return {
            [tool.name]: {
              display_name: tool.name,
              type: tool.type,
              ...(tool.name === BEDROCK_CONSTANTS.TOOL_NAMES.COMPUTER
                ? { options: COMPUTER_USE_OPTIONS }
                : {}),
            },
          } as unknown as BedrockTool;
        }
        return {
          toolSpec: {
            name: tool.name,
            description: tool.description,
            inputSchema: { json: tool.parameters as any },
          },
        } as BedrockTool;
      });

    const command = new ConverseCommand({
      modelId: activeModelId,
      messages: bedrockMessages,
      system,
      toolConfig: bedrockTools ? { tools: bedrockTools } : undefined,
      inferenceConfig: {
        maxTokens: maxTokens ?? config.maxTokens,
        temperature: temperature ?? config.temperature,
        topP: topP ?? DEFAULT_TOP_P,
        stopSequences: stopSequences && stopSequences.length > 0 ? stopSequences : undefined,
      },
      additionalModelRequestFields: {
        ...(config.thinkingEnabled
          ? { thinking: { type: 'enabled', budget_tokens: config.thinkingBudget } }
          : {}),
      },
      ...(responseFormat?.type === BEDROCK_CONSTANTS.RESPONSE_FORMATS.JSON_SCHEMA
        ? { outputConfig: { format: BEDROCK_CONSTANTS.RESPONSE_FORMATS.JSON } }
        : {}),
    } as unknown as any);

    const response = await client.send(command);

    if (response.output?.message) {
      const msg = response.output.message;
      const thought = (msg.content as any[])
        ?.filter((c) => !!c.reasoningContent)
        .map((c) => c.reasoningContent?.reasoningText?.text ?? '')
        .join('\n\n');
      if (thought) logger.debug(`[Bedrock Reasoning] for ${activeModelId}:`, thought);
      const content = msg.content
        ?.filter((c) => c.text)
        .map((c) => c.text)
        .join('\n\n');

      return {
        role: MessageRole.ASSISTANT,
        content: content ?? '',
        thought: thought || '',
        tool_calls:
          msg.content
            ?.filter((c) => c.toolUse)
            .map((c) => ({
              id: c.toolUse!.toolUseId!,
              type: BEDROCK_CONSTANTS.TOOL_TYPES.FUNCTION,
              function: { name: c.toolUse!.name!, arguments: JSON.stringify(c.toolUse!.input) },
            })) ?? [],
        traceId: messages[0]?.traceId ?? 'unknown-trace',
        messageId: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        workspaceId: messages[0]?.workspaceId ?? 'default',
        attachments: [],
        options: [],
        ui_blocks: [],
        agentName: 'Bedrock',
        usage: response.usage
          ? {
              prompt_tokens: response.usage.inputTokens ?? 0,
              completion_tokens: response.usage.outputTokens ?? 0,
              total_tokens: response.usage.totalTokens ?? 0,
            }
          : undefined,
      };
    }
    throw new Error('Bedrock provider call failed: No output message in response');
  }

  async *stream(
    messages: Message[],
    tools?: ITool[],
    profile: ReasoningProfile = ReasoningProfile.STANDARD,
    model?: string,
    _provider?: string,
    responseFormat?: ResponseFormat,
    temperature?: number,
    maxTokens?: number,
    topP?: number,
    stopSequences?: string[]
  ): AsyncIterable<MessageChunk> {
    const client = this.client;
    const activeModelId = model ?? this.modelId;
    const capabilities = await this.getCapabilities(activeModelId);
    profile = normalizeProfile(profile, capabilities, activeModelId);
    const config = BEDROCK_REASONING_MAP[profile];

    const bedrockMessages: BedrockMessage[] = messages
      .filter((m) => m.role !== MessageRole.SYSTEM && m.role !== MessageRole.DEVELOPER)
      .map(convertToBedrockMessage);

    const system: SystemContentBlock[] = messages
      .filter((m) => m.role === MessageRole.SYSTEM || m.role === MessageRole.DEVELOPER)
      .map((m) => ({ text: m.content || '' }));

    const bedrockTools: BedrockTool[] | undefined = tools
      ?.filter(
        (t) =>
          !t.type ||
          t.type === BEDROCK_CONSTANTS.TOOL_TYPES.FUNCTION ||
          t.type === BEDROCK_CONSTANTS.TOOL_TYPES.COMPUTER_USE
      )
      .map((tool) => {
        if (tool.type === BEDROCK_CONSTANTS.TOOL_TYPES.COMPUTER_USE) {
          return {
            [tool.name]: {
              display_name: tool.name,
              type: tool.type,
              ...(tool.name === BEDROCK_CONSTANTS.TOOL_NAMES.COMPUTER
                ? { options: COMPUTER_USE_OPTIONS }
                : {}),
            },
          } as unknown as BedrockTool;
        }
        return {
          toolSpec: {
            name: tool.name,
            description: tool.description,
            inputSchema: { json: tool.parameters as any },
          },
        } as BedrockTool;
      });

    const command = new ConverseStreamCommand({
      modelId: activeModelId,
      messages: bedrockMessages,
      system,
      toolConfig: bedrockTools ? { tools: bedrockTools } : undefined,
      inferenceConfig: {
        maxTokens: maxTokens ?? config.maxTokens,
        temperature: temperature ?? config.temperature,
        topP: topP ?? DEFAULT_TOP_P,
        stopSequences: stopSequences && stopSequences.length > 0 ? stopSequences : undefined,
      },
      additionalModelRequestFields: {
        ...(config.thinkingEnabled
          ? { thinking: { type: 'enabled', budget_tokens: config.thinkingBudget } }
          : {}),
      },
      ...(responseFormat?.type === BEDROCK_CONSTANTS.RESPONSE_FORMATS.JSON_SCHEMA
        ? { outputConfig: { format: BEDROCK_CONSTANTS.RESPONSE_FORMATS.JSON } }
        : {}),
    } as unknown as any);

    const response = await client.send(command);
    if (!response.stream) throw new Error('Bedrock provider call failed: No stream in response');

    const activeToolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();

    for await (const event of response.stream as AsyncIterable<ConverseStreamOutput>) {
      if (event.contentBlockDelta) {
        const delta = event.contentBlockDelta.delta;
        if (!delta) continue;
        if ('text' in delta && delta.text)
          yield {
            content: delta.text,
            tool_calls: [],
            attachments: [],
            ui_blocks: [],
            options: [],
          };
        else if ('reasoningContent' in delta && delta.reasoningContent) {
          const rc = delta.reasoningContent;
          if ('text' in rc && rc.text)
            yield { thought: rc.text, tool_calls: [], attachments: [], ui_blocks: [], options: [] };
        } else if ('toolUse' in delta && delta.toolUse) {
          const idx = event.contentBlockDelta.contentBlockIndex ?? 0;
          const existing = activeToolCalls.get(idx);
          if (existing) existing.arguments += (delta.toolUse as { input?: string }).input ?? '';
        }
      } else if (event.contentBlockStart) {
        const start = event.contentBlockStart.start;
        if (start && 'toolUse' in start && start.toolUse) {
          const idx = event.contentBlockStart.contentBlockIndex ?? 0;
          activeToolCalls.set(idx, {
            id: start.toolUse.toolUseId ?? '',
            name: start.toolUse.name ?? '',
            arguments: '',
          });
        }
      } else if (event.contentBlockStop) {
        const idx = event.contentBlockStop.contentBlockIndex ?? 0;
        const toolCall = activeToolCalls.get(idx);
        if (toolCall) {
          yield {
            tool_calls: [
              {
                id: toolCall.id,
                type: BEDROCK_CONSTANTS.TOOL_TYPES.FUNCTION,
                function: { name: toolCall.name, arguments: toolCall.arguments },
              },
            ],
            attachments: [],
            ui_blocks: [],
            options: [],
          };
          activeToolCalls.delete(idx);
        }
      } else if (event.metadata) {
        const usage = event.metadata.usage;
        if (usage)
          yield {
            usage: {
              prompt_tokens: usage.inputTokens ?? 0,
              completion_tokens: usage.outputTokens ?? 0,
              total_tokens: usage.totalTokens ?? 0,
            },
            tool_calls: [],
            attachments: [],
            ui_blocks: [],
            options: [],
          };
      }
    }
  }

  async getCapabilities(model?: string) {
    const activeModelId = model ?? this.modelId;
    const isClaude46 = CLAUDE_46_MODELS.some((m) => activeModelId.includes(m));
    return {
      supportedReasoningProfiles: isClaude46
        ? [
            ReasoningProfile.FAST,
            ReasoningProfile.STANDARD,
            ReasoningProfile.THINKING,
            ReasoningProfile.DEEP,
          ]
        : [ReasoningProfile.FAST, ReasoningProfile.STANDARD],
      supportsStructuredOutput: isClaude46,
      maxReasoningEffort: 'high',
      contextWindow: DEFAULT_CONTEXT_WINDOW,
      supportedAttachmentTypes: [AttachmentType.IMAGE, AttachmentType.FILE],
    };
  }
}
