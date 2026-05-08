import {
  IProvider,
  Message,
  ITool,
  ReasoningProfile,
  AttachmentType,
  MessageRole,
  DeepSeekModel,
  MessageChunk,
  ResponseFormat,
} from '../types/index';
import { logger } from '../logger';
import { normalizeProfile, resolveProviderApiKey } from './utils';

// --- Constants and Configuration ---
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
const CONTENT_TYPES = {
  TEXT: 'text' as const,
  IMAGE_URL: 'image_url' as const,
};
const MIME_TYPES = {
  PNG: 'image/png',
  OCTET_STREAM: 'application/octet-stream',
};
const TOOL_TYPES = {
  FUNCTION: 'function',
} as const;

/**
 * Known context windows for DeepSeek models.
 */
const CONTEXT_WINDOWS: Record<string, number> = {
  [DeepSeekModel.V4_FLASH]: 131072,
  [DeepSeekModel.V4_PRO]: 131072,
  default: 131072,
};

/**
 * Mapping of reasoning profiles to DeepSeek reasoning_effort values.
 * DeepSeek API supports standard OpenAI-compatible reasoning parameters.
 */
const DEEPSEEK_REASONING_MAP: Record<
  ReasoningProfile,
  { effort: 'low' | 'medium' | 'high'; enabled?: boolean }
> = {
  [ReasoningProfile.FAST]: { effort: 'low', enabled: false },
  [ReasoningProfile.STANDARD]: { effort: 'medium', enabled: true },
  [ReasoningProfile.THINKING]: { effort: 'high', enabled: true },
  [ReasoningProfile.DEEP]: { effort: 'high', enabled: true },
};

/**
 * Interface for DeepSeek API response.
 */
interface DeepSeekResponse {
  choices?: {
    index?: number;
    message?: {
      role?: string;
      content?: string | null;
      reasoning_content?: string;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    delta?: {
      role?: string;
      content?: string;
      reasoning_content?: string;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason?: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Provider for DeepSeek API (OpenAI-compatible endpoint).
 * Supports DeepSeek V4 Flash and V4 Pro models.
 */
export class DeepSeekProvider implements IProvider {
  /**
   * Initializes the DeepSeek provider.
   * @param model The model ID to use (defaults to DeepSeek V4 Flash).
   */
  constructor(private model: string = DeepSeekModel.V4_FLASH) {}

  /**
   * Converts internal Claw tool definitions to DeepSeek-compatible format.
   */
  private transformTools(tools?: ITool[]): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }> {
    if (!tools || tools.length === 0) return [];

    return tools
      .filter((t) => !t.type || t.type === 'function')
      .map((t) => ({
        type: TOOL_TYPES.FUNCTION,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters as unknown as Record<string, unknown>,
        },
      }));
  }

  /**
   * Performs a non-streaming chat completion call.
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
    const apiKey = resolveProviderApiKey('DeepSeek', 'DeepSeekApiKey', 'DEEPSEEK_API_KEY');
    const baseUrl = DEEPSEEK_BASE_URL;
    const activeModel = model ?? this.model;

    const capabilities = await this.getCapabilities(activeModel);
    profile = normalizeProfile(profile, capabilities, activeModel);

    const config = DEEPSEEK_REASONING_MAP[profile];

    const body: Record<string, unknown> = {
      model: activeModel,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      reasoning_effort: config.effort,
      ...(responseFormat && responseFormat.type === 'json_schema'
        ? {
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: responseFormat.json_schema?.name ?? 'response',
                schema: responseFormat.json_schema?.schema ?? {},
                strict: responseFormat.json_schema?.strict ?? true,
              },
            },
          }
        : {}),
      ...(temperature !== undefined ? { temperature } : {}),
      ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
      ...(topP !== undefined ? { top_p: topP } : {}),
      ...(stopSequences && stopSequences.length > 0 ? { stop: stopSequences } : {}),
    };

    if (tools && tools.length > 0) {
      body['tools'] = this.transformTools(tools);
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek Provider error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as DeepSeekResponse;
    const msg = data.choices?.[0]?.message;

    if (!msg) throw new Error('DeepSeek provider call failed: No message in response');

    return {
      role: MessageRole.ASSISTANT,
      content: msg.content ?? '',
      thought: msg.reasoning_content,
      tool_calls: msg.tool_calls
        ? msg.tool_calls.map((tc) => ({
            id: tc.id,
            type: TOOL_TYPES.FUNCTION,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          }))
        : undefined,
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
    const apiKey = resolveProviderApiKey('DeepSeek', 'DeepSeekApiKey', 'DEEPSEEK_API_KEY');
    const baseUrl = DEEPSEEK_BASE_URL;
    const activeModel = model ?? this.model;

    const capabilities = await this.getCapabilities(activeModel);
    profile = normalizeProfile(profile, capabilities, activeModel);

    const config = DEEPSEEK_REASONING_MAP[profile];

    const body: Record<string, unknown> = {
      model: activeModel,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      stream: true,
      reasoning_effort: config.effort,
      ...(responseFormat && responseFormat.type === 'json_schema'
        ? {
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: responseFormat.json_schema?.name ?? 'response',
                schema: responseFormat.json_schema?.schema ?? {},
                strict: responseFormat.json_schema?.strict ?? true,
              },
            },
          }
        : {}),
      ...(temperature !== undefined ? { temperature } : {}),
      ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
      ...(topP !== undefined ? { top_p: topP } : {}),
      ...(stopSequences && stopSequences.length > 0 ? { stop: stopSequences } : {}),
    };

    if (tools && tools.length > 0) {
      body['tools'] = this.transformTools(tools);
    }

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`DeepSeek Provider error: ${response.status} - ${error}`);
      }

      if (!response.body) {
        yield { content: ' (No stream body)' };
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamDone = false;

      const parseChunk = (line: string): (DeepSeekResponse & { done?: boolean }) | null => {
        if (!line.startsWith('data: ')) return null;
        const dataStr = line.slice(6).trim();
        if (dataStr === '[DONE]') return { done: true };
        try {
          return JSON.parse(dataStr) as DeepSeekResponse;
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

          if (delta.reasoning_content && typeof delta.reasoning_content === 'string') {
            yield { thought: delta.reasoning_content };
          }

          if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
            for (const toolCall of delta.tool_calls) {
              yield {
                tool_calls: [
                  {
                    id: toolCall.id ?? '',
                    type: TOOL_TYPES.FUNCTION,
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
      logger.error('DeepSeek streaming failed:', err);
      yield { content: ' (Streaming failed)' };
    }
  }

  /**
   * Retrieves the capabilities of a specific DeepSeek model.
   */
  async getCapabilities(model?: string) {
    const activeModel = model ?? this.model;
    const isPro = activeModel.includes('pro');

    return {
      supportedReasoningProfiles: isPro
        ? [
            ReasoningProfile.FAST,
            ReasoningProfile.STANDARD,
            ReasoningProfile.THINKING,
            ReasoningProfile.DEEP,
          ]
        : [ReasoningProfile.FAST, ReasoningProfile.STANDARD, ReasoningProfile.THINKING],
      maxReasoningEffort: isPro ? 'high' : 'medium',
      supportsStructuredOutput: true,
      contextWindow: CONTEXT_WINDOWS[activeModel] ?? CONTEXT_WINDOWS['default'],
      supportedAttachmentTypes: [AttachmentType.IMAGE],
    };
  }
}