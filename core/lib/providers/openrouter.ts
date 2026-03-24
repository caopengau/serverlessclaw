import {
  IProvider,
  Message,
  ITool,
  ReasoningProfile,
  MessageRole,
  OpenRouterModel,
} from '../types/index';
import { Resource } from 'sst';
import { logger } from '../logger';
import { normalizeProfile, capEffort, createEmptyResponse } from './utils';

const OPENROUTER_REASONING_MAP: Record<
  ReasoningProfile,
  { effort: 'low' | 'medium' | 'high'; enabled: boolean; route: 'latency' | 'fallback' }
> = {
  [ReasoningProfile.FAST]: { effort: 'low', enabled: false, route: 'latency' },
  [ReasoningProfile.STANDARD]: { effort: 'low', enabled: true, route: 'fallback' },
  [ReasoningProfile.THINKING]: { effort: 'medium', enabled: true, route: 'fallback' },
  [ReasoningProfile.DEEP]: { effort: 'high', enabled: true, route: 'fallback' },
};

/**
 * Provider for OpenRouter, aggregating multiple high-capability models (GLM, Gemini).
 * Implements dynamic capability detection and standardized reasoning parameters.
 */
export class OpenRouterProvider implements IProvider {
  constructor(private model: string = OpenRouterModel.GEMINI_3_FLASH) {}

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
    const apiKey = ('OpenRouterApiKey' in resource ? resource.OpenRouterApiKey.value : '') ?? '';
    const baseUrl = 'https://openrouter.ai/api/v1';
    const activeModel = model ?? this.model;

    // Fallback if profile not supported
    const capabilities = await this.getCapabilities(activeModel);
    profile = normalizeProfile(profile, capabilities, activeModel);

    const reasoningConfig = OPENROUTER_REASONING_MAP[profile];
    const reasoningEffort = capEffort(reasoningConfig.effort, capabilities.maxReasoningEffort);

    const processedMessages = messages.map((m) => {
      if (!m.attachments || m.attachments.length === 0) {
        return m;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const content: any[] = [];
      if (m.content) {
        content.push({ type: 'text', text: m.content });
      }

      m.attachments.forEach((att) => {
        if (att.type === 'image') {
          content.push({
            type: 'image_url',
            image_url: {
              url: att.url ?? `data:${att.mimeType ?? 'image/png'};base64,${att.base64}`,
            },
          });
        } else if (att.type === 'file') {
          // OpenRouter/OpenAI-compatible file input
          content.push({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            type: 'input_file' as any,
            input_file: {
              file_id:
                att.url ??
                `data:${att.mimeType ?? 'application/octet-stream'};base64,${att.base64}`,
            },
          });
        }
      });

      return {
        ...m,
        content: content.length === 1 && content[0].type === 'text' ? m.content : content,
      };
    });

    const body: Record<string, unknown> = {
      model: activeModel,
      messages: processedMessages,
      route: reasoningConfig.route,
      reasoning: {
        effort: reasoningEffort,
        enabled: reasoningConfig.enabled,
      },
      ...(responseFormat ? { response_format: responseFormat } : {}),
      // 2026: Provider routing and privacy defaults
      provider: {
        allow_fallbacks: true,
        data_collection: 'deny',
        prompt_cache: true,
        // Ensure routing to providers supporting requested features (tools, json_schema)
        ...(responseFormat || (tools && tools.length > 0) ? { require_parameters: true } : {}),
      },
      // 2026: specialized model-specific extra bodies
      ...(activeModel.includes('glm') ? { plugin_id: 'reasoning', include_reasoning: true } : {}),
      ...(activeModel.includes('gemini-3') ? { safety_settings: 'off' } : {}),
    };

    if (tools && tools.length > 0) {
      body['tools'] = tools.map((t) => {
        if (t.type && t.type !== 'function') {
          return { type: t.type };
        }
        return {
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        };
      });

      // 2026: Specialized Google Gemini Grounded Search
      if (
        activeModel.includes('gemini') &&
        tools.some((t) => t.type === 'google_search_retrieval')
      ) {
        body['google_search_retrieval'] = {
          dynamic_retrieval: {
            mode: 'unspecified',
            dynamic_threshold: 0.3,
          },
        };
      }
    }

    // 2026: Force JSON format for models that require explicit mime types (Gemini 3)
    if (responseFormat?.type === 'json_schema' && activeModel.includes('gemini-3')) {
      body['response_format'] = { type: 'json_object' };
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/serverlessclaw/serverlessclaw',
        'X-Title': 'Serverless Claw',
        'X-OpenRouter-Caching': 'true',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter Provider error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      choices?: {
        message: Message & {
          reasoning_details?: unknown[];
        };
      }[];
    };
    const message = data.choices?.[0]?.message;

    if (!message) {
      return createEmptyResponse('OpenRouter');
    }

    // 2026 Log reasoning details for observability if present
    if (message.reasoning_details) {
      logger.debug(
        `[OpenRouter Reasoning] for ${activeModel}:`,
        JSON.stringify(message.reasoning_details)
      );
    }

    // Extract reasoning text for thought field
    let thought: string | undefined;
    if (message.reasoning_details && Array.isArray(message.reasoning_details)) {
      const parts = (message.reasoning_details as Array<{ text?: string }>)
        .filter((d) => d.text)
        .map((d) => d.text);
      if (parts.length > 0) {
        thought = parts.join('\n\n');
      }
    }

    return {
      role: MessageRole.ASSISTANT,
      content: message.content ?? '',
      thought,
      tool_calls: message.tool_calls,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      usage: (data as any).usage
        ? {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            prompt_tokens: (data as any).usage.prompt_tokens ?? 0,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            completion_tokens: (data as any).usage.completion_tokens ?? 0,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            total_tokens: (data as any).usage.total_tokens ?? 0,
          }
        : undefined,
    } as Message;
  }

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
    const apiKey = ('OpenRouterApiKey' in resource ? resource.OpenRouterApiKey.value : '') ?? '';
    const baseUrl = 'https://openrouter.ai/api/v1';
    const activeModel = model ?? this.model;

    const capabilities = await this.getCapabilities(activeModel);
    profile = normalizeProfile(profile, capabilities, activeModel);

    const reasoningConfig = OPENROUTER_REASONING_MAP[profile];
    const reasoningEffort = capEffort(reasoningConfig.effort, capabilities.maxReasoningEffort);

    const processedMessages = messages.map((m) => {
      if (!m.attachments || m.attachments.length === 0) {
        return m;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const content: any[] = [];
      if (m.content) {
        content.push({ type: 'text', text: m.content });
      }

      m.attachments.forEach((att) => {
        if (att.type === 'image') {
          content.push({
            type: 'image_url',
            image_url: {
              url: att.url ?? `data:${att.mimeType ?? 'image/png'};base64,${att.base64}`,
            },
          });
        } else if (att.type === 'file') {
          content.push({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            type: 'input_file' as any,
            input_file: {
              file_id:
                att.url ??
                `data:${att.mimeType ?? 'application/octet-stream'};base64,${att.base64}`,
            },
          });
        }
      });

      return {
        ...m,
        content: content.length === 1 && content[0].type === 'text' ? m.content : content,
      };
    });

    const body: Record<string, unknown> = {
      model: activeModel,
      messages: processedMessages,
      stream: true,
      route: reasoningConfig.route,
      reasoning: {
        effort: reasoningEffort,
        enabled: reasoningConfig.enabled,
      },
      ...(responseFormat ? { response_format: responseFormat } : {}),
      provider: {
        allow_fallbacks: true,
        data_collection: 'deny',
        prompt_cache: true,
        ...(responseFormat || (tools && tools.length > 0) ? { require_parameters: true } : {}),
      },
      ...(activeModel.includes('glm') ? { plugin_id: 'reasoning', include_reasoning: true } : {}),
      ...(activeModel.includes('gemini-3') ? { safety_settings: 'off' } : {}),
    };

    if (tools && tools.length > 0) {
      body['tools'] = tools.map((t) => {
        if (t.type && t.type !== 'function') {
          return { type: t.type };
        }
        return {
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        };
      });

      if (
        activeModel.includes('gemini') &&
        tools.some((t) => t.type === 'google_search_retrieval')
      ) {
        body['google_search_retrieval'] = {
          dynamic_retrieval: {
            mode: 'unspecified',
            dynamic_threshold: 0.3,
          },
        };
      }
    }

    if (responseFormat?.type === 'json_schema' && activeModel.includes('gemini-3')) {
      body['response_format'] = { type: 'json_object' };
    }

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://github.com/serverlessclaw/serverlessclaw',
          'X-Title': 'Serverless Claw',
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parseChunk = (line: string): any | null => {
        if (!line.startsWith('data: ')) return null;
        const data = line.slice(6).trim();
        if (data === '[DONE]') return { done: true };
        try {
          return JSON.parse(data);
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

          // Yield usage from final chunk (may have no choices)
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

          if (delta.content) {
            yield { content: delta.content };
          }

          if (delta.reasoning_details && Array.isArray(delta.reasoning_details)) {
            for (const rd of delta.reasoning_details) {
              if (rd.text) {
                yield { thought: rd.text };
              }
            }
          }

          if (delta.reasoning && typeof delta.reasoning === 'string') {
            yield { thought: delta.reasoning };
          }

          if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              yield {
                tool_calls: [
                  {
                    id: tc.id ?? '',
                    type: 'function',
                    function: {
                      name: tc.function?.name ?? '',
                      arguments: tc.function?.arguments ?? '',
                    },
                  },
                ],
              };
            }
          }
        }
      }

      // Process any remaining buffer
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

  async getCapabilities(model?: string) {
    const activeModel = model ?? this.model;
    // 2026: Dynamic capability detection based on model ID patterns.
    // Standardized reasoning models in OpenRouter usually contain these keywords.
    const isHighCapability =
      activeModel.includes('glm') ||
      activeModel.includes('gemini-3') ||
      activeModel.includes('claude-3-7') || // Hypothetical 2026 Claude
      activeModel.includes('gpt-5');

    let contextWindow = 128000;
    if (activeModel.includes('gemini-3')) contextWindow = 1048576;
    else if (activeModel.includes('glm')) contextWindow = 200000;

    return {
      supportedReasoningProfiles: isHighCapability
        ? [
            ReasoningProfile.FAST,
            ReasoningProfile.STANDARD,
            ReasoningProfile.THINKING,
            ReasoningProfile.DEEP,
          ]
        : [ReasoningProfile.FAST, ReasoningProfile.STANDARD],
      maxReasoningEffort: 'high', // OpenRouter's reasoning.effort usually caps at high
      supportsStructuredOutput: true,
      contextWindow,
    };
  }
}
