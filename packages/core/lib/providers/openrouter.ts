import {
  IProvider,
  Message,
  ITool,
  ReasoningProfile,
  AttachmentType,
  MessageRole,
  OpenRouterModel,
  Attachment,
  MessageChunk,
  ResponseFormat,
} from '../types/index';
import { logger } from '../logger';
import { normalizeProfile, capEffort, resolveProviderApiKey } from './utils';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const PROJECT_REFERER = 'https://github.com/serverlessclaw/serverlessclaw';
const PROJECT_TITLE = 'Serverless Claw';
const DEFAULT_DYNAMIC_THRESHOLD = 0.3;

const OPENROUTER_CONSTANTS = {
  CONTENT_TYPES: {
    TEXT: 'text' as const,
    IMAGE_URL: 'image_url' as const,
    INPUT_FILE: 'input_file' as const,
  },
  MIME_TYPES: {
    PNG: 'image/png',
    OCTET_STREAM: 'application/octet-stream',
  },
  TOOL_TYPES: {
    FUNCTION: 'function',
    GOOGLE_SEARCH: 'google_search_retrieval',
  },
  MODELS: {
    GEMINI_PREFIX: 'gemini',
    GEMINI_3: 'gemini-3',
    GLM: 'glm',
  },
  RESPONSE_FORMATS: {
    JSON_SCHEMA: 'json_schema',
    JSON_OBJECT: 'json_object' as const,
  },
} as const;

const CONTEXT_WINDOWS: Record<string, number> = {
  [OPENROUTER_CONSTANTS.MODELS.GEMINI_3]: 1048576,
  [OPENROUTER_CONSTANTS.MODELS.GLM]: 200000,
  default: 128000,
};

function applyModelSpecificConfig(
  body: Record<string, unknown>,
  activeModel: string,
  tools?: ITool[],
  responseFormat?: ResponseFormat
): void {
  if (activeModel.includes(OPENROUTER_CONSTANTS.MODELS.GLM)) {
    body['plugin_id'] = 'reasoning';
    body['include_reasoning'] = true;
  }

  const isGemini = activeModel.includes(OPENROUTER_CONSTANTS.MODELS.GEMINI_PREFIX);
  const isGemini3 = activeModel.includes(OPENROUTER_CONSTANTS.MODELS.GEMINI_3);

  if (isGemini3) {
    if (responseFormat?.type === OPENROUTER_CONSTANTS.RESPONSE_FORMATS.JSON_SCHEMA) {
      body['response_format'] = { type: OPENROUTER_CONSTANTS.RESPONSE_FORMATS.JSON_OBJECT };
    }
    body['safety_settings'] = 'off';
  }

  if (isGemini && tools?.some((t) => t.type === OPENROUTER_CONSTANTS.TOOL_TYPES.GOOGLE_SEARCH)) {
    body['google_search_retrieval'] = {
      dynamic_retrieval: { mode: 'unspecified', dynamic_threshold: DEFAULT_DYNAMIC_THRESHOLD },
    };
  }
}

const OPENROUTER_REASONING_MAP: Record<
  ReasoningProfile,
  { effort: 'low' | 'medium' | 'high'; enabled: boolean; route: 'latency' | 'fallback' }
> = {
  [ReasoningProfile.FAST]: { effort: 'low', enabled: false, route: 'latency' },
  [ReasoningProfile.STANDARD]: { effort: 'low', enabled: true, route: 'fallback' },
  [ReasoningProfile.THINKING]: { effort: 'medium', enabled: true, route: 'fallback' },
  [ReasoningProfile.DEEP]: { effort: 'high', enabled: true, route: 'fallback' },
};

interface OpenRouterContentBlock {
  type: (typeof OPENROUTER_CONSTANTS.CONTENT_TYPES)[keyof typeof OPENROUTER_CONSTANTS.CONTENT_TYPES];
  text?: string;
  image_url?: { url: string };
  input_file?: { file_id: string };
}

interface OpenRouterResponse {
  choices?: {
    message?: Message & {
      reasoning_details?: Array<{ text?: string }>;
      reasoning?: string;
    };
    delta?: Message & {
      reasoning_details?: Array<{ text?: string }>;
      reasoning?: string;
    };
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

function createContentBlock(attachment: Attachment): OpenRouterContentBlock | null {
  if (attachment.type === 'image') {
    return {
      type: OPENROUTER_CONSTANTS.CONTENT_TYPES.IMAGE_URL,
      image_url: {
        url:
          attachment.url ??
          `data:${attachment.mimeType ?? OPENROUTER_CONSTANTS.MIME_TYPES.PNG};base64,${attachment.base64}`,
      },
    };
  }

  if (attachment.type === 'file') {
    return {
      type: OPENROUTER_CONSTANTS.CONTENT_TYPES.INPUT_FILE,
      input_file: {
        file_id:
          attachment.url ??
          `data:${attachment.mimeType ?? OPENROUTER_CONSTANTS.MIME_TYPES.OCTET_STREAM};base64,${attachment.base64}`,
      },
    };
  }

  return null;
}

function convertToOpenRouterMessage(message: Message) {
  if (message.attachments.length === 0) {
    return message;
  }

  const content: OpenRouterContentBlock[] = [];
  if (message.content) {
    content.push({ type: OPENROUTER_CONSTANTS.CONTENT_TYPES.TEXT, text: message.content });
  }

  message.attachments.forEach((attachment) => {
    const block = createContentBlock(attachment);
    if (block) content.push(block);
  });

  return {
    ...message,
    content:
      content.length === 1 && content[0].type === OPENROUTER_CONSTANTS.CONTENT_TYPES.TEXT
        ? message.content
        : content,
  };
}

/**
 * Provider for OpenRouter.
 */
export class OpenRouterProvider implements IProvider {
  constructor(private model: string = OpenRouterModel.GEMINI_3_FLASH) {}

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

    let thought = '';
    if (msg.reasoning_details && Array.isArray(msg.reasoning_details)) {
      const parts = msg.reasoning_details.filter((d) => d.text).map((d) => d.text as string);
      if (parts.length > 0) thought = parts.join('\n\n');
    }

    return {
      role: MessageRole.ASSISTANT,
      content: msg.content ?? '',
      thought,
      tool_calls: msg.tool_calls ?? [],
      traceId: messages[0]?.traceId ?? 'unknown-trace',
      messageId: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      workspaceId: messages[0]?.workspaceId ?? 'default',
      attachments: [],
      options: [],
      ui_blocks: [],
      agentName: 'OpenRouter',
      usage: data.usage
        ? {
            prompt_tokens: data.usage.prompt_tokens ?? 0,
            completion_tokens: data.usage.completion_tokens ?? 0,
            total_tokens: data.usage.total_tokens ?? 0,
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
        yield { content: ' (No stream body)', tool_calls: [], attachments: [], ui_blocks: [] };
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
              tool_calls: [],
              attachments: [],
              ui_blocks: [],
            };
          }

          if (!choice) continue;

          const delta = choice.delta;
          if (!delta) continue;

          if (delta.content)
            yield { content: delta.content, tool_calls: [], attachments: [], ui_blocks: [] };

          if (delta.reasoning_details && Array.isArray(delta.reasoning_details)) {
            for (const detail of delta.reasoning_details) {
              if (detail.text)
                yield {
                  thought: (detail as { text: string }).text,
                  tool_calls: [],
                  attachments: [],
                  ui_blocks: [],
                };
            }
          }

          if (delta.reasoning && typeof delta.reasoning === 'string')
            yield { thought: delta.reasoning, tool_calls: [], attachments: [], ui_blocks: [] };

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
                attachments: [],
                ui_blocks: [],
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
            tool_calls: [],
            attachments: [],
            ui_blocks: [],
          };
        }
      }
    } catch (err) {
      logger.error('OpenRouter streaming failed:', err);
      yield { content: ' (Streaming failed)', tool_calls: [], attachments: [], ui_blocks: [] };
    }
  }

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
