import OpenAI from 'openai';
import {
  IProvider,
  Message,
  ITool,
  ReasoningProfile,
  AttachmentType,
  MessageRole,
  OpenAIModel,
  MessageChunk,
  ResponseFormat,
} from '../types/index';
import { OPENAI } from '../constants';
import { logger } from '../logger';
import { normalizeProfile, capEffort, resolveProviderApiKey } from './utils';
import { OpenAIResponse } from './openai/types';
import {
  shouldRequestReasoningSummary,
  isReasoningSummaryUnsupportedError,
  extractSummaryText,
  extractReasoningSummary,
  splitThoughtIntoChunks,
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
const OPENAI_CONTEXT_WINDOW = 128000;
const OPENAI_MAX_REASONING_EFFORT_DEFAULT = 'xhigh';
const OPENAI_MAX_REASONING_EFFORT_MINI = 'high';
const OPENAI_MAX_REASONING_EFFORT_NANO = 'medium';

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
    const requestedProfile = profile;

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
    profile = normalizeProfile(profile, capabilities, activeModel);

    const reasoningEffort = capEffort(
      REASONING_MAP[profile] as string,
      capabilities.maxReasoningEffort
    );

    const hasTools = tools && tools.length > 0;
    const responsesInput = mapMessagesToResponsesInput(messages);
    const shouldRequestSummary = shouldRequestReasoningSummary(activeModel, requestedProfile);

    const requestPayload: Record<string, unknown> = {
      model: activeModel as OpenAI.ResponsesModel,
      input: responsesInput,
      reasoning: {
        effort: reasoningEffort as OpenAI.ReasoningEffort,
        ...(shouldRequestSummary ? { summary: 'auto' } : {}),
      },
      ...(responseFormat
        ? {
            text: {
              format:
                responseFormat.type === OPENAI_JSON_SCHEMA
                  ? {
                      type: OPENAI_JSON_SCHEMA,
                      name: responseFormat.json_schema?.name ?? OPENAI_DEFAULT_RESPONSE_NAME,
                      schema: responseFormat.json_schema?.schema ?? {},
                      strict: responseFormat.json_schema?.strict ?? true,
                      description: responseFormat.json_schema?.description,
                    }
                  : { type: responseFormat.type },
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
        response = (await client.responses.create(requestPayload)) as unknown as OpenAIResponse;
      } catch (err) {
        if (!shouldRequestSummary || !isReasoningSummaryUnsupportedError(err)) throw err;

        logger.warn(`OpenAI reasoning.summary unsupported for ${activeModel}; retrying.`);
        const fallbackPayload = {
          ...requestPayload,
          reasoning: { effort: reasoningEffort as OpenAI.ReasoningEffort },
        };
        response = (await client.responses.create(fallbackPayload)) as unknown as OpenAIResponse;
      }

      const content = response.output_text ?? '';
      const thought = response.output_thought ?? extractReasoningSummary(response.output);
      const toolCalls: Message['tool_calls'] = [];

      if (response.output && Array.isArray(response.output)) {
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
        traceId: messages[0]?.traceId ?? 'unknown-trace',
        messageId: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
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
    const client = this.client;
    const requestedProfile = profile;

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
    profile = normalizeProfile(profile, capabilities, activeModel);
    const reasoningEffort = capEffort(
      REASONING_MAP[profile] as string,
      capabilities.maxReasoningEffort
    );

    const responsesInput = mapMessagesToResponsesInput(messages);
    const shouldRequestSummary = shouldRequestReasoningSummary(activeModel, requestedProfile);

    const requestPayload: Record<string, unknown> = {
      model: activeModel as OpenAI.ResponsesModel,
      input: responsesInput,
      reasoning: {
        effort: reasoningEffort as OpenAI.ReasoningEffort,
        ...(shouldRequestSummary ? { summary: 'auto' } : {}),
      },
      stream: true,
      ...(responseFormat
        ? {
            text: {
              format:
                responseFormat.type === OPENAI_JSON_SCHEMA
                  ? {
                      type: OPENAI_JSON_SCHEMA,
                      name: responseFormat.json_schema?.name ?? OPENAI_DEFAULT_RESPONSE_NAME,
                      schema: responseFormat.json_schema?.schema ?? {},
                      strict: responseFormat.json_schema?.strict ?? true,
                      description: responseFormat.json_schema?.description,
                    }
                  : { type: responseFormat.type },
            },
          }
        : {}),
      ...(tools && tools.length > 0 ? { tools: mapToolsToOpenAI(tools) } : {}),
      ...(temperature !== undefined ? { temperature } : {}),
      ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
      ...(topP !== undefined ? { top_p: topP } : {}),
      ...(stopSequences && stopSequences.length > 0 ? { stop: stopSequences } : {}),
    };

    try {
      let stream: AsyncIterable<any>;
      try {
        stream = (await client.responses.create(requestPayload)) as unknown as AsyncIterable<any>;
      } catch (err) {
        if (!shouldRequestSummary || !isReasoningSummaryUnsupportedError(err)) throw err;

        logger.warn(`OpenAI reasoning.summary unsupported for ${activeModel} streaming; retrying.`);
        const fallbackPayload = {
          ...requestPayload,
          reasoning: { effort: reasoningEffort as OpenAI.ReasoningEffort },
        };
        stream = (await client.responses.create(fallbackPayload)) as unknown as AsyncIterable<any>;
      }

      for await (const chunk of stream) {
        const type = chunk.type || '';
        const delta = chunk.delta ?? chunk.item?.delta;

        const isContentEvent =
          type === OPENAI.EVENT_TYPES.TEXT_DELTA ||
          type === OPENAI.EVENT_TYPES.OUTPUT_TEXT_DELTA ||
          type === OPENAI.EVENT_TYPES.RESPONSE_TEXT_DELTA ||
          type === OPENAI.EVENT_TYPES.RESPONSE_OUTPUT_TEXT_DELTA;
        const isThoughtEvent =
          type === OPENAI.EVENT_TYPES.REASONING_DELTA ||
          type === OPENAI.EVENT_TYPES.OUTPUT_THOUGHT_DELTA ||
          type === OPENAI.EVENT_TYPES.THOUGHT_DELTA ||
          type === OPENAI.EVENT_TYPES.RESPONSE_REASONING_DELTA ||
          type === OPENAI.EVENT_TYPES.RESPONSE_OUTPUT_THOUGHT_DELTA ||
          type === OPENAI.EVENT_TYPES.RESPONSE_THOUGHT_DELTA ||
          type === OPENAI.EVENT_TYPES.REASONING_SUMMARY_DELTA ||
          type === OPENAI.EVENT_TYPES.RESPONSE_REASONING_SUMMARY_DELTA ||
          !!chunk.delta?.reasoning_content ||
          !!chunk.item?.delta?.reasoning_content;

        const isReasoningSummaryItemDone =
          type === OPENAI.EVENT_TYPES.OUTPUT_ITEM_DONE ||
          type === OPENAI.EVENT_TYPES.RESPONSE_OUTPUT_ITEM_DONE;

        if (isContentEvent && delta) {
          const content = typeof delta === 'string' ? delta : (delta.value ?? delta.text ?? '');
          if (content) yield { content };
        } else if (isThoughtEvent) {
          const thought =
            typeof delta === 'string'
              ? delta
              : (delta?.value ??
                delta?.text ??
                chunk.delta?.reasoning_content ??
                chunk.item?.delta?.reasoning_content ??
                '');
          if (thought) yield { thought };
        } else if (
          (type === OPENAI.EVENT_TYPES.MESSAGE_DELTA ||
            type === OPENAI.EVENT_TYPES.RESPONSE_MESSAGE_DELTA) &&
          chunk.delta
        ) {
          if (chunk.delta.content) yield { content: chunk.delta.content };
          if (chunk.delta.reasoning) yield { thought: chunk.delta.reasoning };
        } else if (
          isReasoningSummaryItemDone &&
          chunk.item?.type === OPENAI.STREAM_PROPS.REASONING &&
          Array.isArray(chunk.item?.summary)
        ) {
          const summaryText = extractSummaryText(chunk.item.summary);
          if (summaryText.length > 0) {
            const summaryChunks = splitThoughtIntoChunks(summaryText);
            for (const thoughtChunk of summaryChunks) {
              yield { thought: thoughtChunk };
            }
          }
        } else if (
          isReasoningSummaryItemDone &&
          chunk.item?.type === OPENAI.STREAM_PROPS.FUNCTION_CALL
        ) {
          yield {
            tool_calls: [
              {
                id: chunk.item.call_id ?? '',
                type: OPENAI.FUNCTION_TYPE,
                function: {
                  name: chunk.item.name ?? '',
                  arguments: chunk.item.arguments ?? '',
                },
              },
            ],
          };
        } else if (
          (type === OPENAI.EVENT_TYPES.USAGE || type === OPENAI.EVENT_TYPES.RESPONSE_USAGE) &&
          (chunk.usage || chunk.response?.usage)
        ) {
          const usage = chunk.usage || chunk.response?.usage;
          yield {
            usage: {
              prompt_tokens: usage.prompt_tokens ?? 0,
              completion_tokens: usage.completion_tokens ?? 0,
              total_tokens: usage.total_tokens ?? 0,
            },
          };
        }
      }
    } catch (err) {
      logger.error('OpenAI streaming failed:', err);
      throw new Error(
        `OpenAI streaming failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  async getCapabilities(model?: string) {
    const activeModel = model ?? this.model;
    const isReasoningModel = activeModel.includes('gpt-5');
    const isMiniModel = activeModel.includes('mini');
    const isNanoModel = activeModel.includes('nano');

    let maxReasoningEffort = OPENAI_MAX_REASONING_EFFORT_DEFAULT;
    if (isMiniModel) maxReasoningEffort = OPENAI_MAX_REASONING_EFFORT_MINI;
    else if (isNanoModel) maxReasoningEffort = OPENAI_MAX_REASONING_EFFORT_NANO;

    return {
      supportedReasoningProfiles: isReasoningModel
        ? [
            ReasoningProfile.FAST,
            ReasoningProfile.STANDARD,
            ReasoningProfile.THINKING,
            ReasoningProfile.DEEP,
          ]
        : [ReasoningProfile.FAST, ReasoningProfile.STANDARD],
      maxReasoningEffort,
      supportsStructuredOutput: true,
      contextWindow: OPENAI_CONTEXT_WINDOW,
      supportedAttachmentTypes: [AttachmentType.IMAGE, AttachmentType.FILE],
    };
  }
}
