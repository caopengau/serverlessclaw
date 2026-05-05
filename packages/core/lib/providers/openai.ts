import OpenAI from 'openai';
import {
  IProvider,
  Message,
  ITool,
  ReasoningProfile,
  MessageRole,
  OpenAIModel,
  MessageChunk,
  ResponseFormat,
} from '../types/index';
import { OPENAI } from '../constants';
import { logger } from '../logger';
import { normalizeProfile, capEffort, resolveProviderApiKey } from './utils';
import { OpenAIResponse, EffectiveCallOptions, EffectiveResponseFormat } from './openai/types';
import {
  shouldRequestReasoningSummary,
  isReasoningSummaryUnsupportedError,
  extractReasoningSummary,
  mapMessagesToResponsesInput,
  mapToolsToOpenAI,
} from './openai/utils';

const REASONING_MAP: Record<ReasoningProfile, OpenAI.ReasoningEffort> = {
  [ReasoningProfile.FAST]: 'low',
  [ReasoningProfile.STANDARD]: 'medium',
  [ReasoningProfile.THINKING]: 'xhigh',
  [ReasoningProfile.DEEP]: 'xhigh',
};

const OPENAI_JSON_SCHEMA = 'json_schema';
const OPENAI_DEFAULT_RESPONSE_NAME = 'response';

/**
 * Provider for OpenAI's LLM services, supporting GPT-5 and reasoning models.
 * Utilizes the Responses API for 2026-grade reasoning and tool use.
 */
export class OpenAIProvider implements IProvider {
  private static _client: OpenAI | null = null;
  private static _currentKey: string | null = null;

  constructor(private model: string = OpenAIModel.GPT_5_4) {}

  /**
   * Lazily initializes and returns the OpenAI client instance.
   */
  private get client(): OpenAI {
    const apiKey = resolveProviderApiKey('OpenAI', 'OpenAIApiKey', 'OPENAI_API_KEY');

    if (!OpenAIProvider._client || OpenAIProvider._currentKey !== apiKey) {
      OpenAIProvider._client = new OpenAI({ apiKey });
      OpenAIProvider._currentKey = apiKey;
    }
    return OpenAIProvider._client;
  }

  private async getEffectiveOptions(
    messages: Message[],
    model?: string,
    profile: ReasoningProfile = ReasoningProfile.STANDARD
  ): Promise<EffectiveCallOptions> {
    let activeModel = model ?? this.model;
    if (!model && profile) {
      const profileToModel: Record<ReasoningProfile, string> = {
        [ReasoningProfile.FAST]: OpenAIModel.GPT_5_4_NANO,
        [ReasoningProfile.STANDARD]: OpenAIModel.GPT_5_4_MINI,
        [ReasoningProfile.THINKING]: OpenAIModel.GPT_5_4_MINI,
        [ReasoningProfile.DEEP]: OpenAIModel.GPT_5_4,
      };
      activeModel = profileToModel[profile] ?? activeModel;
    }

    const capabilities = await this.getCapabilities(activeModel);
    const normalizedProfile = normalizeProfile(profile, capabilities, activeModel);

    return {
      model: activeModel,
      profile: normalizedProfile,
      workspaceId: messages[0]?.workspaceId ?? 'default',
      traceId: messages[0]?.traceId ?? 'unknown-trace',
    };
  }

  private getEffectiveResponseFormat(rf?: ResponseFormat): EffectiveResponseFormat | undefined {
    if (!rf) return undefined;
    return {
      type: rf.type,
      name: rf.json_schema?.name ?? OPENAI_DEFAULT_RESPONSE_NAME,
      schema: (rf.json_schema?.schema as Record<string, unknown>) ?? {},
      strict: rf.json_schema?.strict ?? true,
      description: rf.json_schema?.description,
    };
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
    const options = await this.getEffectiveOptions(messages, model, profile);
    const rf = this.getEffectiveResponseFormat(responseFormat);
    const hasTools = tools && tools.length > 0;

    const capabilities = await this.getCapabilities(options.model);
    const reasoningEffort = capEffort(REASONING_MAP[options.profile] as string, capabilities.maxReasoningEffort);

    const responsesInput = mapMessagesToResponsesInput(messages);
    const shouldRequestSummary = shouldRequestReasoningSummary(options.model, profile);

    const requestPayload: Record<string, unknown> = {
      model: options.model as OpenAI.ResponsesModel,
      input: responsesInput,
      reasoning: {
        effort: reasoningEffort as OpenAI.ReasoningEffort,
        ...(shouldRequestSummary ? { summary: 'auto' } : {}),
      },
      ...(rf
        ? {
            text: {
              format:
                rf.type === OPENAI_JSON_SCHEMA
                  ? {
                      type: OPENAI_JSON_SCHEMA,
                      name: rf.name,
                      schema: rf.schema,
                      strict: rf.strict,
                      description: rf.description,
                    }
                  : { type: rf.type },
            },
          }
        : {}),
      ...(hasTools ? { tools: mapToolsToOpenAI(tools) } : {}),
      ...(temperature !== undefined ? { temperature } : {}),
      ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
      ...(topP !== undefined ? { top_p: topP } : {}),
      ...(stopSequences && stopSequences.length > 0 ? { stop: stopSequences } : {}),
    };

    try {
      let response: OpenAIResponse;
      try {
        response = (await this.client.responses.create(requestPayload)) as unknown as OpenAIResponse;
      } catch (err) {
        if (!shouldRequestSummary || !isReasoningSummaryUnsupportedError(err)) throw err;

        logger.warn(`OpenAI reasoning.summary unsupported for ${options.model}; retrying.`);
        const fallbackPayload = {
          ...requestPayload,
          reasoning: { effort: reasoningEffort as OpenAI.ReasoningEffort },
        };
        response = (await this.client.responses.create(fallbackPayload)) as unknown as OpenAIResponse;
      }

      const content = response.output_text ?? '';
      const thought = response.output_thought ?? extractReasoningSummary(response.output) ?? '';
      const toolCalls: Message['tool_calls'] = [];

      if (response.output) {
        for (const item of response.output) {
          if (item.type === OPENAI.ITEM_TYPES.FUNCTION_CALL) {
            toolCalls.push({
              id: item.call_id ?? '',
              type: OPENAI.FUNCTION_TYPE,
              function: {
                name: item.name ?? '',
                arguments: item.arguments ?? '',
              },
            });
          }
        }
      }

      return {
        role: MessageRole.ASSISTANT,
        content,
        thought,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        traceId: options.traceId,
        messageId: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        workspaceId: options.workspaceId,
        attachments: [],
        options: [],
        ui_blocks: [],
        agentName: 'OpenAI',
        usage: response.usage
          ? {
              prompt_tokens: response.usage.prompt_tokens ?? 0,
              completion_tokens: response.usage.completion_tokens ?? 0,
              total_tokens: response.usage.total_tokens ?? 0,
            }
          : undefined,
      };
    } catch (err) {
      logger.error('OpenAI Responses API failed:', err);
      throw new Error(
        `OpenAI provider call failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
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
  ): AsyncGenerator<MessageChunk> {
    const options = await this.getEffectiveOptions(messages, model, profile);
    const rf = this.getEffectiveResponseFormat(responseFormat);
    const hasTools = tools && tools.length > 0;

    const capabilities = await this.getCapabilities(options.model);
    const reasoningEffort = capEffort(REASONING_MAP[options.profile] as string, capabilities.maxReasoningEffort);

    const responsesInput = mapMessagesToResponsesInput(messages);
    const shouldRequestSummary = shouldRequestReasoningSummary(options.model, profile);

    const requestPayload: Record<string, unknown> = {
      model: options.model as OpenAI.ResponsesModel,
      input: responsesInput,
      stream: true,
      reasoning: {
        effort: reasoningEffort as OpenAI.ReasoningEffort,
        ...(shouldRequestSummary ? { summary: 'auto' } : {}),
      },
      ...(rf
        ? {
            text: {
              format:
                rf.type === OPENAI_JSON_SCHEMA
                  ? {
                      type: OPENAI_JSON_SCHEMA,
                      name: rf.name,
                      schema: rf.schema,
                      strict: rf.strict,
                      description: rf.description,
                    }
                  : { type: rf.type },
            },
          }
        : {}),
      ...(hasTools ? { tools: mapToolsToOpenAI(tools) } : {}),
      ...(temperature !== undefined ? { temperature } : {}),
      ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
      ...(topP !== undefined ? { top_p: topP } : {}),
      ...(stopSequences && stopSequences.length > 0 ? { stop: stopSequences } : {}),
    };

    try {
      const stream = await this.client.responses.create(requestPayload as any);

      for await (const chunk of stream as any) {
        const choice = chunk.choices?.[0];
        if (chunk.usage) {
          yield {
            usage: {
              prompt_tokens: chunk.usage.prompt_tokens ?? 0,
              completion_tokens: chunk.usage.completion_tokens ?? 0,
              total_tokens: chunk.usage.total_tokens ?? 0,
            },
            tool_calls: [],
            attachments: [],
            ui_blocks: [],
          };
        }

        if (!choice) continue;
        const delta = choice.delta;
        if (!delta) continue;

        if (delta.content) {
          yield { content: delta.content, tool_calls: [], attachments: [], ui_blocks: [] };
        }

        if (delta.tool_calls) {
          yield {
            tool_calls: delta.tool_calls.map((tc: any) => ({
              id: tc.id ?? '',
              type: 'function',
              function: {
                name: tc.function?.name ?? '',
                arguments: tc.function?.arguments ?? '',
              },
            })),
            attachments: [],
            ui_blocks: [],
          };
        }
      }
    } catch (err) {
      logger.error('OpenAI streaming failed:', err);
      yield { content: ' (Streaming failed)', tool_calls: [], attachments: [], ui_blocks: [] };
    }
  }

  async getCapabilities(model?: string) {
    const activeModel = model ?? this.model;
    const isGpt5Family = activeModel.includes('gpt-5');

    return {
      supportedReasoningProfiles: isGpt5Family
        ? [
            ReasoningProfile.FAST,
            ReasoningProfile.STANDARD,
            ReasoningProfile.THINKING,
            ReasoningProfile.DEEP,
          ]
        : [ReasoningProfile.FAST, ReasoningProfile.STANDARD],
      maxReasoningEffort: activeModel.includes('mini') ? 'high' : activeModel.includes('nano') ? 'medium' : 'xhigh',
      supportsStructuredOutput: true,
      contextWindow: 128000,
      supportedAttachmentTypes: [AttachmentType.IMAGE],
    };
  }
}
