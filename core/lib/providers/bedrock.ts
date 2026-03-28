import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  Message as BedrockMessage,
  SystemContentBlock,
  Tool as BedrockTool,
  ContentBlock,
  ToolResultContentBlock,
  ConverseStreamOutput,
} from '@aws-sdk/client-bedrock-runtime';
import {
  IProvider,
  Message,
  ITool,
  ReasoningProfile,
  MessageRole,
  BedrockModel,
} from '../types/index';
import { Resource } from 'sst';
import { logger } from '../logger';
import { normalizeProfile, createEmptyResponse, SUPPORTED_IMAGE_FORMATS } from './utils';

// --- Constants and Configuration ---
const DEFAULT_REGION = 'ap-southeast-2';
const DEFAULT_TOP_P = 0.9;
const DEFAULT_CONTEXT_WINDOW = 200000;
const CLAUDE_46_MODELS = ['claude-sonnet-4-6', 'claude-4-6', 'claude-v4.6'];

/**
 * Dimensions and options for the 'computer' tool in computer-use scenarios.
 */
const COMPUTER_USE_OPTIONS = {
  display_height: 768,
  display_width: 1024,
  display_number: 0,
};

/**
 * Configuration for models that support reasoning/thinking budgets.
 */
interface BedrockReasoningConfig {
  thinkingBudget: number;
  thinkingEnabled: boolean;
  maxTokens: number;
  temperature: number;
}

const imgFormats = SUPPORTED_IMAGE_FORMATS;

const BEDROCK_REASONING_MAP: Record<ReasoningProfile, BedrockReasoningConfig> = {
  [ReasoningProfile.FAST]: {
    thinkingBudget: 0,
    thinkingEnabled: false,
    maxTokens: 4096,
    temperature: 0.7,
  },
  [ReasoningProfile.STANDARD]: {
    thinkingBudget: 1024,
    thinkingEnabled: true,
    maxTokens: 8192,
    temperature: 0.7,
  },
  [ReasoningProfile.THINKING]: {
    thinkingBudget: 4096,
    thinkingEnabled: true,
    maxTokens: 12288,
    temperature: 1.0,
  },
  [ReasoningProfile.DEEP]: {
    thinkingBudget: 32768,
    thinkingEnabled: true,
    maxTokens: 49152,
    temperature: 1.0,
  },
};

/**
 * Provider for AWS Bedrock LLM services, specifically optimized for Anthropic Claude 4.6.
 * Implements 'thinking' budgets and native multi-modal support via the Converse API.
 */
export class BedrockProvider implements IProvider {
  /**
   * Initializes the Bedrock provider.
   * @param modelId The model ID to use (defaults to Claude 4.6).
   */
  constructor(private modelId: string = BedrockModel.CLAUDE_4_6) {}

  /**
   * Performs a non-streaming chat completion call via Bedrock Converse API.
   *
   * @param messages The conversation history.
   * @param tools Optional list of tools for function calling.
   * @param profile The preferred reasoning profile.
   * @param model Override for the model ID.
   * @param _provider Ignored provider identifier.
   * @param responseFormat Preferred format for the response.
   * @returns A promise resolving to the assistant's message.
   */
  async call(
    messages: Message[],
    tools?: ITool[],
    profile: ReasoningProfile = ReasoningProfile.STANDARD,
    model?: string,
    _provider?: string,
    responseFormat?: import('../types/index').ResponseFormat
  ): Promise<Message> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resource = Resource as any;
    const client = new BedrockRuntimeClient({
      region: ('AwsRegion' in resource ? resource.AwsRegion.value : undefined) ?? DEFAULT_REGION,
    });
    const activeModelId = model ?? this.modelId;

    // Fallback if profile not supported
    const capabilities = await this.getCapabilities(activeModelId);
    profile = normalizeProfile(profile, capabilities, activeModelId);

    const reasoningConfig = BEDROCK_REASONING_MAP[profile];

    // 2026 Bedrock Optimization: Converse API System/User mapping
    const bedrockMessages: BedrockMessage[] = messages
      .filter(
        (message) => message.role !== MessageRole.SYSTEM && message.role !== MessageRole.DEVELOPER
      )
      .map((message) => {
        let role: 'user' | 'assistant' = 'user';
        if (message.role === MessageRole.ASSISTANT) role = 'assistant';

        const content: ContentBlock[] = [{ text: message.content ?? '' }];

        if (message.attachments && message.role !== MessageRole.TOOL) {
          message.attachments.forEach((attachment) => {
            const format = (attachment.mimeType?.split('/')[1] ?? 'png').toLowerCase();
            if (attachment.type === 'image' && (imgFormats as readonly string[]).includes(format)) {
              content.push({
                image: {
                  format: format as 'png' | 'jpeg' | 'gif' | 'webp',
                  source: {
                    bytes: attachment.base64
                      ? Buffer.from(attachment.base64, 'base64')
                      : new Uint8Array(),
                  },
                },
              });
            } else if (attachment.type === 'file') {
              // 2026 Bedrock Converse API: Support for document attachments
              content.push({
                document: {
                  name: attachment.name ?? 'document',
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  format: (attachment.mimeType?.split('/')[1] ?? 'pdf') as any,
                  source: {
                    bytes: attachment.base64
                      ? Buffer.from(attachment.base64, 'base64')
                      : new Uint8Array(),
                  },
                },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              } as any);
            }
          });
        }

        if (message.tool_calls) {
          message.tool_calls.forEach(
            (toolCall: { id: string; function: { name: string; arguments: string } }) => {
              content.push({
                toolUse: {
                  toolUseId: toolCall.id,
                  name: toolCall.function.name,
                  input: JSON.parse(toolCall.function.arguments),
                },
              });
            }
          );
        }

        if (message.role === MessageRole.TOOL) {
          const toolContent: ToolResultContentBlock[] = [];
          toolContent.push({ text: message.content ?? '' });

          if (message.attachments) {
            message.attachments.forEach((attachment) => {
              const format = (attachment.mimeType?.split('/')[1] ?? 'png').toLowerCase();
              if (
                attachment.type === 'image' &&
                (imgFormats as readonly string[]).includes(format)
              ) {
                toolContent.push({
                  image: {
                    format: format as 'png' | 'jpeg' | 'gif' | 'webp',
                    source: {
                      bytes: attachment.base64
                        ? Buffer.from(attachment.base64, 'base64')
                        : new Uint8Array(),
                    },
                  },
                });
              } else if (attachment.type === 'file') {
                toolContent.push({
                  document: {
                    name: attachment.name ?? 'document',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    format: (attachment.mimeType?.split('/')[1] ?? 'pdf') as any,
                    source: {
                      bytes: attachment.base64
                        ? Buffer.from(attachment.base64, 'base64')
                        : new Uint8Array(),
                    },
                  },
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any);
              }
            });
          }

          content.push({
            toolResult: {
              toolUseId: message.tool_call_id!,
              content: toolContent,
              status: 'success',
            },
          });
        }

        return { role, content };
      });

    const system: SystemContentBlock[] = messages
      .filter((m) => m.role === MessageRole.SYSTEM || m.role === MessageRole.DEVELOPER)
      .map((m) => ({ text: m.content ?? '' }));

    const bedrockTools: BedrockTool[] | undefined = tools
      ?.filter((tool) => !tool.type || tool.type === 'function' || tool.type === 'computer_use')
      .map((tool) => {
        if (tool.type === 'computer_use') {
          return {
            [tool.name]: {
              display_name: tool.name,
              type: tool.type,
              ...(tool.name === 'computer'
                ? {
                    options: COMPUTER_USE_OPTIONS,
                  }
                : {}),
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any;
        }
        return {
          toolSpec: {
            name: tool.name,
            description: tool.description,
            inputSchema: {
              json: tool.parameters as unknown as Record<string, unknown>,
            },
          },
        };
      }) as unknown as BedrockTool[];

    const command = new ConverseCommand({
      modelId: activeModelId,
      messages: bedrockMessages,
      system,
      toolConfig: bedrockTools ? { tools: bedrockTools } : undefined,
      inferenceConfig: {
        maxTokens: reasoningConfig.maxTokens,
        temperature: reasoningConfig.temperature,
        topP: DEFAULT_TOP_P,
      },
      additionalModelRequestFields: {
        ...(reasoningConfig.thinkingEnabled
          ? {
              thinking: {
                type: 'enabled',
                budget_tokens: reasoningConfig.thinkingBudget,
              },
            }
          : {}),
      },
      ...(responseFormat?.type === 'json_schema'
        ? {
            outputConfig: {
              format: 'json',
            },
          }
        : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const response = await client.send(command);

    if (response.output?.message) {
      const msg = response.output.message;

      interface ReasoningBlock {
        reasoningContent?: {
          reasoningText?: {
            text?: string;
          };
        };
      }

      const reasoning = (msg.content as (ContentBlock | ReasoningBlock)[])
        ?.filter((c) => !!(c as ReasoningBlock).reasoningContent)
        .map((c) => (c as ReasoningBlock).reasoningContent?.reasoningText?.text ?? '')
        .join('\n\n');

      if (reasoning) {
        logger.debug(`[Bedrock Reasoning] for ${activeModelId}:`, reasoning);
      }

      // Aggregate all text blocks (model might return multiple)
      const content = msg.content
        ?.filter((c) => c.text)
        .map((c) => c.text)
        .join('\n\n');

      return {
        role: MessageRole.ASSISTANT,
        content: content ?? '',
        thought: reasoning || undefined,
        tool_calls: msg.content
          ?.filter((c) => c.toolUse)
          .map((c) => ({
            id: c.toolUse!.toolUseId!,
            type: 'function',
            function: {
              name: c.toolUse!.name!,
              arguments: JSON.stringify(c.toolUse!.input),
            },
          })),
        usage: response.usage
          ? {
              prompt_tokens: response.usage.inputTokens ?? 0,
              completion_tokens: response.usage.outputTokens ?? 0,
              total_tokens: response.usage.totalTokens ?? 0,
            }
          : undefined,
      } as Message;
    }

    return createEmptyResponse('Bedrock');
  }

  /**
   * Performs a streaming chat completion call via Bedrock Converse Stream API.
   */
  async *stream(
    messages: Message[],
    tools?: ITool[],
    profile: ReasoningProfile = ReasoningProfile.STANDARD,
    model?: string,
    _provider?: string,
    responseFormat?: import('../types/index').ResponseFormat
  ): AsyncIterable<import('../types/index').MessageChunk> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resource = Resource as any;
    const client = new BedrockRuntimeClient({
      region: ('AwsRegion' in resource ? resource.AwsRegion.value : undefined) ?? DEFAULT_REGION,
    });
    const activeModelId = model ?? this.modelId;

    const capabilities = await this.getCapabilities(activeModelId);
    profile = normalizeProfile(profile, capabilities, activeModelId);

    const reasoningConfig = BEDROCK_REASONING_MAP[profile];

    // Reuse message conversion logic (ideally extracted to helper)
    const bedrockMessages: BedrockMessage[] = messages
      .filter(
        (message) => message.role !== MessageRole.SYSTEM && message.role !== MessageRole.DEVELOPER
      )
      .map((message) => {
        let role: 'user' | 'assistant' = 'user';
        if (message.role === MessageRole.ASSISTANT) role = 'assistant';

        const content: ContentBlock[] = [{ text: message.content ?? '' }];

        if (message.attachments && message.role !== MessageRole.TOOL) {
          message.attachments.forEach((attachment) => {
            const format = (attachment.mimeType?.split('/')[1] ?? 'png').toLowerCase();
            if (attachment.type === 'image' && (imgFormats as readonly string[]).includes(format)) {
              content.push({
                image: {
                  format: format as 'png' | 'jpeg' | 'gif' | 'webp',
                  source: {
                    bytes: attachment.base64
                      ? Buffer.from(attachment.base64, 'base64')
                      : new Uint8Array(),
                  },
                },
              });
            } else if (attachment.type === 'file') {
              content.push({
                document: {
                  name: attachment.name ?? 'document',
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  format: (attachment.mimeType?.split('/')[1] ?? 'pdf') as any,
                  source: {
                    bytes: attachment.base64
                      ? Buffer.from(attachment.base64, 'base64')
                      : new Uint8Array(),
                  },
                },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              } as any);
            }
          });
        }

        if (message.tool_calls) {
          message.tool_calls.forEach(
            (toolCall: { id: string; function: { name: string; arguments: string } }) => {
              content.push({
                toolUse: {
                  toolUseId: toolCall.id,
                  name: toolCall.function.name,
                  input: JSON.parse(toolCall.function.arguments),
                },
              });
            }
          );
        }

        if (message.role === MessageRole.TOOL) {
          const toolContent: ToolResultContentBlock[] = [];
          toolContent.push({ text: message.content ?? '' });

          if (message.attachments) {
            message.attachments.forEach((attachment) => {
              const format = (attachment.mimeType?.split('/')[1] ?? 'png').toLowerCase();
              if (
                attachment.type === 'image' &&
                (imgFormats as readonly string[]).includes(format)
              ) {
                toolContent.push({
                  image: {
                    format: format as 'png' | 'jpeg' | 'gif' | 'webp',
                    source: {
                      bytes: attachment.base64
                        ? Buffer.from(attachment.base64, 'base64')
                        : new Uint8Array(),
                    },
                  },
                });
              } else if (attachment.type === 'file') {
                toolContent.push({
                  document: {
                    name: attachment.name ?? 'document',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    format: (attachment.mimeType?.split('/')[1] ?? 'pdf') as any,
                    source: {
                      bytes: attachment.base64
                        ? Buffer.from(attachment.base64, 'base64')
                        : new Uint8Array(),
                    },
                  },
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any);
              }
            });
          }

          content.push({
            toolResult: {
              toolUseId: message.tool_call_id!,
              content: toolContent,
              status: 'success',
            },
          });
        }

        return { role, content };
      });

    const system: SystemContentBlock[] = messages
      .filter((m) => m.role === MessageRole.SYSTEM || m.role === MessageRole.DEVELOPER)
      .map((m) => ({ text: m.content ?? '' }));

    const bedrockTools: BedrockTool[] | undefined = tools
      ?.filter((tool) => !tool.type || tool.type === 'function' || tool.type === 'computer_use')
      .map((tool) => {
        if (tool.type === 'computer_use') {
          return {
            [tool.name]: {
              display_name: tool.name,
              type: tool.type,
              ...(tool.name === 'computer'
                ? {
                    options: COMPUTER_USE_OPTIONS,
                  }
                : {}),
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any;
        }
        return {
          toolSpec: {
            name: tool.name,
            description: tool.description,
            inputSchema: {
              json: tool.parameters as unknown as Record<string, unknown>,
            },
          },
        };
      }) as unknown as BedrockTool[];

    try {
      const command = new ConverseStreamCommand({
        modelId: activeModelId,
        messages: bedrockMessages,
        system,
        toolConfig: bedrockTools ? { tools: bedrockTools } : undefined,
        inferenceConfig: {
          maxTokens: reasoningConfig.maxTokens,
          temperature: reasoningConfig.temperature,
          topP: DEFAULT_TOP_P,
        },
        additionalModelRequestFields: {
          ...(reasoningConfig.thinkingEnabled
            ? {
                thinking: {
                  type: 'enabled',
                  budget_tokens: reasoningConfig.thinkingBudget,
                },
              }
            : {}),
        },
        ...(responseFormat?.type === 'json_schema'
          ? {
              outputConfig: {
                format: 'json',
              },
            }
          : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const response = await client.send(command);

      if (!response.stream) {
        yield { content: ' (No stream)' };
        return;
      }

      // Track tool calls across stream events
      const activeToolCalls: Map<number, { id: string; name: string; arguments: string }> =
        new Map();

      for await (const event of response.stream as AsyncIterable<ConverseStreamOutput>) {
        if (event.contentBlockDelta) {
          const delta = event.contentBlockDelta.delta;
          if (!delta) continue;

          if ('text' in delta && delta.text) {
            yield { content: delta.text };
          } else if ('reasoningContent' in delta && delta.reasoningContent) {
            const rc = delta.reasoningContent;
            if ('text' in rc && rc.text) {
              yield { thought: rc.text };
            }
          } else if ('toolUse' in delta && delta.toolUse) {
            const idx = event.contentBlockDelta.contentBlockIndex ?? 0;
            const existing = activeToolCalls.get(idx);
            if (existing) {
              existing.arguments += (delta.toolUse as { input?: string }).input ?? '';
            }
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
                  type: 'function',
                  function: {
                    name: toolCall.name,
                    arguments: toolCall.arguments,
                  },
                },
              ],
            };
            activeToolCalls.delete(idx);
          }
        } else if (event.metadata) {
          const usage = event.metadata.usage;
          if (usage) {
            yield {
              usage: {
                prompt_tokens: usage.inputTokens ?? 0,
                completion_tokens: usage.outputTokens ?? 0,
                total_tokens: usage.totalTokens ?? 0,
              },
            };
          }
        }
      }
    } catch (err) {
      logger.error('Bedrock streaming failed:', err);
      yield { content: ' (Streaming failed)' };
    }
  }

  /**
   * Retrieves the capabilities of a specific model on Bedrock.
   *
   * @param model The model ID to check.
   * @returns An object describing reasoning profiles, structured output support, and context window.
   */
  async getCapabilities(model?: string) {
    const activeModelId = model ?? this.modelId;
    // 2026: Expanded check for all Claude 4.6 variations (Sonnet, Haiku, Opus)
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
      contextWindow: DEFAULT_CONTEXT_WINDOW,
    };
  }
}
