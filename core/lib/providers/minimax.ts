import {
  IProvider,
  Message,
  ITool,
  ReasoningProfile,
  MessageRole,
  MiniMaxModel,
} from '../types/index';
import { Resource } from 'sst';
import { logger } from '../logger';
import { createEmptyResponse } from './utils';

const MINIMAX_REASONING_MAP: Record<
  ReasoningProfile,
  { effort: 'low' | 'medium' | 'high'; enabled: boolean }
> = {
  [ReasoningProfile.FAST]: { effort: 'low', enabled: false },
  [ReasoningProfile.STANDARD]: { effort: 'low', enabled: true },
  [ReasoningProfile.THINKING]: { effort: 'medium', enabled: true },
  [ReasoningProfile.DEEP]: { effort: 'high', enabled: true },
};

/**
 * Direct provider for MiniMax API using Anthropic-compatible endpoint.
 * Provides native access to MiniMax M2.7 models with reasoning capabilities.
 *
 * MiniMax M2.7 is their latest model with:
 * - 204,800 context window
 * - Interleaved thinking for tool use
 * - Advanced reasoning capabilities
 * - ~60 tps output speed (standard) / ~100 tps (highspeed variant)
 *
 * Uses Anthropic-compatible API (MiniMax's recommended approach) for:
 * - Native reasoning support
 * - Better tool use with interleaved thinking
 * - Direct API connection instead of OpenRouter for lower latency
 */
export class MiniMaxProvider implements IProvider {
  constructor(private model: string = MiniMaxModel.M2_7) {}

  async call(
    messages: Message[],
    tools?: ITool[],
    profile: ReasoningProfile = ReasoningProfile.STANDARD,
    model?: string,
    _provider?: string,
    _responseFormat?: import('../types/index').ResponseFormat
  ): Promise<Message> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resource = Resource as any;
    const apiKey = ('MiniMaxApiKey' in resource ? resource.MiniMaxApiKey.value : '') ?? '';
    const baseUrl = 'https://api.minimax.io/v1';
    const activeModel = model ?? this.model;

    const reasoningConfig = MINIMAX_REASONING_MAP[profile];

    // Anthropic-compatible API format
    const { systemMessage, userMessages } = this.extractSystemMessage(messages);

    const body: Record<string, unknown> = {
      anthropic_version: '2024-10-22',
      model: activeModel,
      max_tokens: 4096,
      messages: userMessages,
      ...(systemMessage ? { system: systemMessage } : {}),
      // MiniMax reasoning configuration - only include when enabled
      ...(reasoningConfig.enabled
        ? {
            thinking: {
              type: 'enabled',
              budget_tokens: this.getThinkingBudget(reasoningConfig.effort),
            },
          }
        : {}),
    };

    if (tools && tools.length > 0) {
      body['tools'] = this.transformToolsToAnthropic(tools);
    }

    // Anthropic API endpoint for messages
    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2024-10-22',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MiniMax Provider error: ${response.status} - ${error}`);
    }

    // Parse Anthropic API response format
    const data = (await response.json()) as {
      id?: string;
      type?: string;
      content?: Array<{ type: string; text?: string; thinking?: string }>;
      stop_reason?: string;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
      };
    };

    if (!data.content || data.content.length === 0) {
      return createEmptyResponse('MiniMax');
    }

    // Extract text content from response
    const textContent = data.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('');

    // Log thinking content for observability
    const thinkingContent = data.content.find((c) => c.type === 'thinking');
    if (thinkingContent) {
      logger.debug(`[MiniMax Thinking] for ${activeModel}:`, thinkingContent.thinking ?? '');
    }

    return {
      role: MessageRole.ASSISTANT,
      content: textContent,
      usage: data.usage
        ? {
            prompt_tokens: data.usage.input_tokens ?? 0,
            completion_tokens: data.usage.output_tokens ?? 0,
            total_tokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
          }
        : undefined,
    } as Message;
  }

  /**
   * Extract system message and convert remaining messages to Anthropic format.
   */
  private extractSystemMessage(messages: Message[]): {
    systemMessage: string | undefined;
    userMessages: { role: string; content: string }[];
  } {
    let systemMessage: string | undefined;
    const userMessages: { role: string; content: string }[] = [];

    for (const msg of messages) {
      if (msg.role === MessageRole.SYSTEM) {
        systemMessage = msg.content;
      } else if (msg.role === MessageRole.USER) {
        userMessages.push({
          role: 'user',
          content: msg.content ?? '',
        });
      } else if (msg.role === MessageRole.ASSISTANT) {
        userMessages.push({
          role: 'assistant',
          content: msg.content ?? '',
        });
      }
    }

    return { systemMessage, userMessages };
  }

  /**
   * Transform tools to Anthropic format.
   */
  private transformToolsToAnthropic(tools: ITool[]) {
    return tools
      .filter((t) => !t.type || t.type === 'function')
      .map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
  }

  /**
   * Get thinking budget tokens based on effort level.
   */
  private getThinkingBudget(effort: string): number {
    switch (effort) {
      case 'high':
        return 16000;
      case 'medium':
        return 8000;
      case 'low':
      default:
        return 4000;
    }
  }

  async getCapabilities(_model?: string) {
    // MiniMax M2.7 has 204,800 context window
    const contextWindow = 204800;

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
    };
  }
}
