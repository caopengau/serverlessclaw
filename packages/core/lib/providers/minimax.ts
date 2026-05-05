import Anthropic from '@anthropic-ai/sdk';
import {
  IProvider,
  Message,
  ITool,
  ReasoningProfile,
  AttachmentType,
  MessageRole,
  MiniMaxModel,
  ToolCall,
  MessageChunk,
  ResponseFormat,
} from '../types/index';
import { logger } from '../logger';
import { normalizeProfile, resolveProviderApiKey } from './utils';

const MINIMAX_CONTEXT_WINDOW = 204800;
const MINIMAX_DEFAULT_MAX_TOKENS = 4096;
const MINIMAX_API_BASE_URL = 'https://api.minimax.io/anthropic';

const BLOCK_TYPE_THINKING = 'thinking';
const BLOCK_TYPE_TEXT = 'text';
const BLOCK_TYPE_TOOL_USE = 'tool_use';
const BLOCK_TYPE_TOOL_RESULT = 'tool_result';
const FORMAT_JSON_SCHEMA = 'json_schema';

const MINIMAX_REASONING_MAP: Record<ReasoningProfile, { budget_tokens: number; enabled: boolean }> =
  {
    [ReasoningProfile.FAST]: { budget_tokens: 2000, enabled: false },
    [ReasoningProfile.STANDARD]: { budget_tokens: 4000, enabled: true },
    [ReasoningProfile.THINKING]: { budget_tokens: 8000, enabled: true },
    [ReasoningProfile.DEEP]: { budget_tokens: 16000, enabled: true },
  };

/**
 * Direct provider for MiniMax API using Anthropic-compatible endpoint.
 */
export class MiniMaxProvider implements IProvider {
  constructor(private model: string = MiniMaxModel.M2_7) {}

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
    const apiKey = resolveProviderApiKey('MiniMax', 'MiniMaxApiKey', 'MINIMAX_API_KEY');
    const activeModel = model ?? this.model;

    const capabilities = await this.getCapabilities(activeModel);
    profile = normalizeProfile(profile, capabilities, activeModel);

    const reasoningConfig = MINIMAX_REASONING_MAP[profile];

    const client = new Anthropic({
      apiKey,
      baseURL: MINIMAX_API_BASE_URL,
    });

    const { systemMessage, anthropicMessages } = this.convertMessages(messages);

    const requestParams: Record<string, unknown> = {
      model: activeModel,
      max_tokens: maxTokens ?? MINIMAX_DEFAULT_MAX_TOKENS,
      messages: anthropicMessages,
      ...(systemMessage ? { system: systemMessage } : {}),
      ...(temperature !== undefined ? { temperature } : {}),
      ...(topP !== undefined ? { top_p: topP } : {}),
      ...(stopSequences && stopSequences.length > 0 ? { stop_sequences: stopSequences } : {}),
      ...(reasoningConfig.enabled && responseFormat?.type !== FORMAT_JSON_SCHEMA
        ? {
            thinking: {
              type: 'enabled',
              budget_tokens: reasoningConfig.budget_tokens,
            },
          }
        : {}),
    };

    if (tools && tools.length > 0) {
      requestParams['tools'] = this.transformToolsToAnthropic(tools);
    }

    if (responseFormat?.type === FORMAT_JSON_SCHEMA && responseFormat.json_schema) {
      requestParams['output_config'] = {
        format: {
          type: FORMAT_JSON_SCHEMA,
          schema: responseFormat.json_schema.schema,
        },
      };
    }

    const response = await client.messages.create(
      requestParams as Anthropic.MessageCreateParamsNonStreaming
    );

    const content = response.content;
    let textContent = '';
    const tool_calls: ToolCall[] = [];

    for (const block of content) {
      if (block.type === BLOCK_TYPE_THINKING) {
        logger.debug(
          `[MiniMax Thinking] for ${activeModel}:`,
          (block as { thinking?: string }).thinking ?? ''
        );
      } else if (block.type === BLOCK_TYPE_TEXT) {
        textContent += block.text;
      } else if (block.type === BLOCK_TYPE_TOOL_USE) {
        tool_calls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        });
      }
    }

    return {
      role: MessageRole.ASSISTANT,
      content: textContent,
      thought:
        (content.find((b) => b.type === BLOCK_TYPE_THINKING) as { thinking?: string })?.thinking ??
        '',
      tool_calls,
      traceId: messages[0]?.traceId ?? 'unknown-trace',
      messageId: response.id,
      workspaceId: messages[0]?.workspaceId ?? 'default',
      attachments: [],
      options: [],
      ui_blocks: [],
      agentName: 'MiniMax',
      usage: response.usage
        ? {
            prompt_tokens: response.usage.input_tokens,
            completion_tokens: response.usage.output_tokens,
            total_tokens: response.usage.input_tokens + response.usage.output_tokens,
          }
        : undefined,
    };
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
    const apiKey = resolveProviderApiKey('MiniMax', 'MiniMaxApiKey', 'MINIMAX_API_KEY');
    const activeModel = model ?? this.model;

    const capabilities = await this.getCapabilities(activeModel);
    profile = normalizeProfile(profile, capabilities, activeModel);

    const reasoningConfig = MINIMAX_REASONING_MAP[profile];

    const client = new Anthropic({
      apiKey,
      baseURL: MINIMAX_API_BASE_URL,
    });

    const { systemMessage, anthropicMessages } = this.convertMessages(messages);

    const requestParams: Record<string, unknown> = {
      model: activeModel,
      max_tokens: maxTokens ?? MINIMAX_DEFAULT_MAX_TOKENS,
      messages: anthropicMessages,
      stream: true,
      ...(systemMessage ? { system: systemMessage } : {}),
      ...(temperature !== undefined ? { temperature } : {}),
      ...(topP !== undefined ? { top_p: topP } : {}),
      ...(stopSequences && stopSequences.length > 0 ? { stop: stopSequences } : {}),
      ...(reasoningConfig.enabled && responseFormat?.type !== FORMAT_JSON_SCHEMA
        ? {
            thinking: {
              type: 'enabled',
              budget_tokens: reasoningConfig.budget_tokens,
            },
          }
        : {}),
    };

    if (tools && tools.length > 0) {
      requestParams['tools'] = this.transformToolsToAnthropic(tools);
    }

    if (responseFormat?.type === FORMAT_JSON_SCHEMA && responseFormat.json_schema) {
      requestParams['output_config'] = {
        format: {
          type: FORMAT_JSON_SCHEMA,
          schema: responseFormat.json_schema.schema,
        },
      };
    }

    try {
      const stream = await client.messages.create(
        requestParams as Anthropic.MessageCreateParamsStreaming
      );

      let currentToolCall: ToolCall | null = null;

      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_start' &&
          chunk.content_block.type === BLOCK_TYPE_TOOL_USE
        ) {
          currentToolCall = {
            id: chunk.content_block.id,
            type: 'function',
            function: {
              name: chunk.content_block.name,
              arguments: '',
            },
          };
        } else if (chunk.type === 'content_block_delta') {
          if (chunk.delta.type === 'thinking_delta') {
            yield { thought: chunk.delta.thinking, tool_calls: [], attachments: [], ui_blocks: [] };
          } else if (chunk.delta.type === 'text_delta') {
            yield { content: chunk.delta.text, tool_calls: [], attachments: [], ui_blocks: [] };
          } else if (chunk.delta.type === 'input_json_delta' && currentToolCall) {
            currentToolCall.function.arguments += chunk.delta.partial_json;
          }
        } else if (chunk.type === 'content_block_stop' && currentToolCall) {
          yield { tool_calls: [currentToolCall], attachments: [], ui_blocks: [] };
          currentToolCall = null;
        } else if (chunk.type === 'message_delta') {
          if (chunk.usage) {
            yield {
              usage: {
                prompt_tokens: 0, // Anthropic doesn't provide input tokens in message_delta
                completion_tokens: chunk.usage.output_tokens,
                total_tokens: chunk.usage.output_tokens,
              },
              tool_calls: [],
              attachments: [],
              ui_blocks: [],
            };
          }
        }
      }
    } catch (err) {
      logger.error('MiniMax streaming failed:', err);
      throw new Error(
        `MiniMax streaming failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private convertMessages(messages: Message[]) {
    let systemMessage = '';
    const anthropicMessages: Anthropic.MessageParam[] = [];

    for (const msg of messages) {
      const attachments = msg.attachments || [];
      const tool_calls = msg.tool_calls || [];

      if (msg.role === MessageRole.SYSTEM || msg.role === MessageRole.DEVELOPER) {
        systemMessage += (systemMessage ? '\n' : '') + msg.content;
      } else if (msg.role === MessageRole.USER) {
        const content: unknown[] = [];
        if (msg.content) content.push({ type: BLOCK_TYPE_TEXT, text: msg.content });

        if (attachments.length > 0) {
          for (const att of attachments) {
            if (att.type === 'image' && att.base64) {
              content.push({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: att.mimeType || 'image/png',
                  data: att.base64,
                },
              });
            }
          }
        }

        anthropicMessages.push({
          role: 'user',
          content:
            attachments.length === 0
              ? msg.content || ''
              : (content as Anthropic.MessageParam['content']),
        });
      } else if (msg.role === MessageRole.ASSISTANT) {
        if (tool_calls.length > 0) {
          const toolUseBlocks: unknown[] = tool_calls.map((tc) => ({
            type: BLOCK_TYPE_TOOL_USE,
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments || '{}'),
          }));

          anthropicMessages.push({
            role: 'assistant',
            content: [
              ...(msg.content ? [{ type: BLOCK_TYPE_TEXT as any, text: msg.content }] : []),
              ...toolUseBlocks,
            ] as Anthropic.MessageParam['content'],
          });
        } else {
          anthropicMessages.push({
            role: 'assistant',
            content: msg.content || '',
          });
        }
      } else if (msg.role === MessageRole.TOOL) {
        if (attachments.length > 0) {
          const content: unknown[] = [];
          if (msg.content) {
            content.push({ type: BLOCK_TYPE_TEXT, text: msg.content });
          }
          for (const att of attachments) {
            if (att.type === 'image' && att.base64) {
              content.push({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: att.mimeType || 'image/png',
                  data: att.base64,
                },
              });
            }
          }
          anthropicMessages.push({
            role: 'user',
            content: [
              {
                type: BLOCK_TYPE_TOOL_RESULT,
                tool_use_id: msg.tool_call_id ?? '',
                content: content as unknown as (
                  | Anthropic.TextBlockParam
                  | Anthropic.ImageBlockParam
                )[],
              },
            ],
          });
        } else {
          anthropicMessages.push({
            role: 'user',
            content: [
              {
                type: BLOCK_TYPE_TOOL_RESULT,
                tool_use_id: msg.tool_call_id ?? '',
                content: msg.content || '',
              },
            ],
          });
        }
      }
    }

    return { systemMessage, anthropicMessages };
  }

  private transformToolsToAnthropic(tools: ITool[]) {
    return tools
      .filter((t) => !t.type || t.type === 'function')
      .map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
  }

  async getCapabilities(_model?: string) {
    const contextWindow = MINIMAX_CONTEXT_WINDOW;

    return {
      supportedReasoningProfiles: [
        ReasoningProfile.FAST,
        ReasoningProfile.STANDARD,
        ReasoningProfile.THINKING,
        ReasoningProfile.DEEP,
      ],
      maxReasoningEffort: 'high',
      supportsStructuredOutput: true,
      contextWindow,
      supportedAttachmentTypes: [AttachmentType.IMAGE, AttachmentType.FILE],
    };
  }
}
