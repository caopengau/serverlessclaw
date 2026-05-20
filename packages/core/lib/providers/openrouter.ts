import {
  IProvider,
  Message,
  ITool,
  ReasoningProfile,
  AttachmentType,
  MessageRole,
  OpenRouterModel,
  MessageChunk,
  ResponseFormat,
} from '../types/index';
import { logger } from '../logger';
import { normalizeProfile, capEffort, resolveProviderApiKey } from './utils';
import {
  OPENROUTER_BASE_URL,
  PROJECT_REFERER,
  PROJECT_TITLE,
  OPENROUTER_CONSTANTS,
  CONTEXT_WINDOWS,
  OPENROUTER_REASONING_MAP,
} from './openrouter-config';
import { applyModelSpecificConfig, convertToOpenRouterMessage } from './openrouter-helpers';
import { OpenRouterResponse } from './openrouter-types';

/**
 * Provider for OpenRouter, aggregating multiple high-capability models (GLM, Gemini).
 * Implements dynamic capability detection and standardized reasoning parameters.
 */
export class OpenRouterProvider implements IProvider {
  /**
   * Initializes the OpenRouter provider.
   * @param model The model ID to use (defaults to Gemini 3 Flash).
   */
  constructor(private model: string = OpenRouterModel.GEMINI_3_FLASH) {}

  /**
   * Performs a non-streaming chat completion call.
   *
   * @param messages The conversation history.
   * @param tools Optional list of tools for function calling.
   * @param profile The preferred reasoning profile.
   * @param model Override for the model ID.
   * @param _provider Ignored provider identifier.
   * @param responseFormat Preferred format for the response.
   * @param temperature Optional sampling temperature.
   * @param maxTokens Optional maximum tokens to generate.
   * @param topP Optional nucleus sampling probability.
   * @param stopSequences Optional list of stop sequences.
   * @returns A promise resolving to the assistant's message.
   */
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
    const apiKey = resolveProviderApiKey('OpenRouter', 'OpenRouterApiKey', 'OPENROUTER_API_KEY');
    const baseUrl = OPENROUTER_BASE_URL;
    const activeModel = model ?? this.model;

    const capabilities = await this.getCapabilities(activeModel);
    profile = normalizeProfile(profile, capabilities, activeModel);

    const config = OPENROUTER_REASONING_MAP[profile];
    const reasoningEffort = capEffort(config.effort, capabilities.maxReasoningEffort);

    const processedMessages = messages.map(convertToOpenRouterMessage);

    const body: Record<string, unknown> = {
      model: activeModel,
      messages: processedMessages,
      route: config.route,
      reasoning: { effort: reasoningEffort, enabled: config.enabled },
      ...(responseFormat ? { response_format: responseFormat } : {}),
      provider: {
        allow_fallbacks: true,
        data_collection: 'deny',
        prompt_cache: true,
        ...(responseFormat || (tools && tools.length > 0) ? { require_parameters: true } : {}),
      },
      ...(temperature !== undefined ? { temperature } : {}),
      ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
      ...(topP !== undefined ? { top_p: topP } : {}),
      ...(stopSequences && stopSequences.length > 0 ? { stop: stopSequences } : {}),
    };

    applyModelSpecificConfig(body, activeModel, tools, responseFormat);

    if (tools && tools.length > 0) {
      body['tools'] = tools.map((tool) => {
        if (tool.type && tool.type !== OPENROUTER_CONSTANTS.TOOL_TYPES.FUNCTION)
          return { type: tool.type };
        return {
          type: OPENROUTER_CONSTANTS.TOOL_TYPES.FUNCTION,
          function: { name: tool.name, description: tool.description, parameters: tool.parameters },
        };
      });
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': PROJECT_REFERER,
        'X-Title': PROJECT_TITLE,
        'X-OpenRouter-Caching': 'true',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter Provider error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as OpenRouterResponse;
    const msg = data.choices?.[0]?.message;

    if (!msg) throw new Error('OpenRouter provider call failed: No message in response');

    if (msg.reasoning_details) {
      logger.debug(
        `[OpenRouter Reasoning] for ${activeModel}:`,
        JSON.stringify(msg.reasoning_details)
      );
    }

    let thought: string | undefined;
    if (msg.reasoning_details && Array.isArray(msg.reasoning_details)) {
      const parts = msg.reasoning_details.filter((d) => d.text).map((d) => d.text as string);
      if (parts.length > 0) thought = parts.join('\n\n');
    }

    return {
      role: MessageRole.ASSISTANT,
      content: msg.content ?? '',
      thought,
      tool_calls: msg.tool_calls,
      traceId: messages[0]?.traceId ?? 'unknown-trace',
      messageId: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      usage: data.usage
        ? {
            prompt_tokens: data.usage.prompt_tokens ?? 0,
            completion_tokens: data.usage.completion_tokens ?? 0,
            total_tokens: data.usage.total_tokens ?? 0,
          }
        : undefined,
    } as Message;
  }

  /**
   * Performs a streaming chat completion call.
   */
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
    const apiKey = resolveProviderApiKey('OpenRouter', 'OpenRouterApiKey', 'OPENROUTER_API_KEY');
    const baseUrl = OPENROUTER_BASE_URL;
    const activeModel = model ?? this.model;

    const capabilities = await this.getCapabilities(activeModel);
    profile = normalizeProfile(profile, capabilities, activeModel);

    const config = OPENROUTER_REASONING_MAP[profile];
    const reasoningEffort = capEffort(config.effort, capabilities.maxReasoningEffort);

    const processedMessages = messages.map(convertToOpenRouterMessage);

    const body: Record<string, unknown> = {
      model: activeModel,
      messages: processedMessages,
      stream: true,
      route: config.route,
      reasoning: { effort: reasoningEffort, enabled: config.enabled },
      ...(responseFormat ? { response_format: responseFormat } : {}),
      provider: {
        allow_fallbacks: true,
        data_collection: 'deny',
        prompt_cache: true,
        ...(responseFormat || (tools && tools.length > 0) ? { require_parameters: true } : {}),
      },
      ...(temperature !== undefined ? { temperature } : {}),
      ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
      ...(topP !== undefined ? { top_p: topP } : {}),
      ...(stopSequences && stopSequences.length > 0 ? { stop: stopSequences } : {}),
    };

    applyModelSpecificConfig(body, activeModel, tools, responseFormat);

    if (tools && tools.length > 0) {
      body['tools'] = tools.map((tool) => {
        if (tool.type && tool.type !== OPENROUTER_CONSTANTS.TOOL_TYPES.FUNCTION)
          return { type: tool.type };
        return {
          type: OPENROUTER_CONSTANTS.TOOL_TYPES.FUNCTION,
          function: { name: tool.name, description: tool.description, parameters: tool.parameters },
        };
      });
    }

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': PROJECT_REFERER,
          'X-Title': PROJECT_TITLE,
          'X-OpenRouter-Caching': 'true',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenRouter Provider error: ${response.status} - ${error}`);
      }

      if (!response.body) {
        yield { content: ' (No stream body)' };
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamDone = false;

      const parseChunk = (line: string): (OpenRouterResponse & { done?: boolean }) | null => {
        if (!line.startsWith('data: ')) return null;
        const dataStr = line.slice(6).trim();
        if (dataStr === '[DONE]') return { done: true };
        try {
          return JSON.parse(dataStr) as OpenRouterResponse;
        } catch {
          return null;
        }
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const parsed = parseChunk(line);
          if (!parsed) continue;
          if (parsed.done) {
            streamDone = true;
            break;
          }

          const choice = parsed.choices?.[0];

          if (parsed.usage) {
            yield {
              usage: {
                prompt_tokens: parsed.usage.prompt_tokens ?? 0,
                completion_tokens: parsed.usage.completion_tokens ?? 0,
                total_tokens: parsed.usage.total_tokens ?? 0,
              },
            };
          }

          if (!choice) continue;

          const delta = choice.delta;
          if (!delta) continue;

          if (delta.content) yield { content: delta.content };

          if (delta.reasoning_details && Array.isArray(delta.reasoning_details)) {
            for (const detail of delta.reasoning_details) {
              if (detail.text) yield { thought: (detail as { text: string }).text };
            }
          }

          if (delta.reasoning && typeof delta.reasoning === 'string')
            yield { thought: delta.reasoning };

          if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
            for (const toolCall of delta.tool_calls) {
              yield {
                tool_calls: [
                  {
                    id: toolCall.id ?? '',
                    type: OPENROUTER_CONSTANTS.TOOL_TYPES.FUNCTION,
                    function: {
                      name: toolCall.function?.name ?? '',
                      arguments: toolCall.function?.arguments ?? '',
                    },
                  },
                ],
              };
            }
          }
        }
      }

      if (buffer.trim()) {
        const parsed = parseChunk(buffer.trim());
        if (parsed && !parsed.done && parsed.usage) {
          yield {
            usage: {
              prompt_tokens: parsed.usage.prompt_tokens ?? 0,
              completion_tokens: parsed.usage.completion_tokens ?? 0,
              total_tokens: parsed.usage.total_tokens ?? 0,
            },
          };
        }
      }
    } catch (err) {
      logger.error('OpenRouter streaming failed:', err);
      yield { content: ' (Streaming failed)' };
    }
  }

  /**
   * Retrieves the capabilities of a specific model.
   *
   * @param model The model ID to check.
   * @returns An object describing reasoning profiles, structured output support, and context window.
   */
  async getCapabilities(model?: string) {
    const activeModel = model ?? this.model;
    const isHighCapability =
      activeModel.includes(OPENROUTER_CONSTANTS.MODELS.GLM) ||
      activeModel.includes(OPENROUTER_CONSTANTS.MODELS.GEMINI_3) ||
      activeModel.includes('claude-3-7') ||
      activeModel.includes('gpt-5');

    return {
      supportedReasoningProfiles: isHighCapability
        ? [
            ReasoningProfile.FAST,
            ReasoningProfile.STANDARD,
            ReasoningProfile.THINKING,
            ReasoningProfile.DEEP,
          ]
        : [ReasoningProfile.FAST, ReasoningProfile.STANDARD],
      maxReasoningEffort: 'high',
      supportsStructuredOutput: true,
      contextWindow: activeModel.includes(OPENROUTER_CONSTANTS.MODELS.GEMINI_3)
        ? CONTEXT_WINDOWS[OPENROUTER_CONSTANTS.MODELS.GEMINI_3]
        : activeModel.includes(OPENROUTER_CONSTANTS.MODELS.GLM)
          ? CONTEXT_WINDOWS[OPENROUTER_CONSTANTS.MODELS.GLM]
          : CONTEXT_WINDOWS['default'],
      supportedAttachmentTypes: [AttachmentType.IMAGE, AttachmentType.FILE],
    };
  }
}
