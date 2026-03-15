import { ReasoningProfile, ICapabilities, ITool, Message, MessageRole } from '../types/index';
import { logger } from '../logger';

/**
 * Transforms internal tools to OpenAI function format.
 * Consolidates tool transformation logic used in OpenAI and OpenRouter providers.
 */
export function transformToolsToOpenAI(tools?: ITool[]): Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    strict: boolean;
  };
}> {
  if (!tools || tools.length === 0) return [];

  return tools
    .filter((t) => !t.type || t.type === 'function')
    .map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters as unknown as Record<string, unknown>,
        strict: true,
      },
    }));
}

/**
 * Maps internal message roles to OpenAI-compatible roles.
 */
export function mapToOpenAIRole(
  role: string
): 'system' | 'user' | 'assistant' | 'developer' | 'tool' {
  switch (role) {
    case 'system':
    case 'developer':
      return 'developer';
    case 'assistant':
      return 'assistant';
    case 'tool':
      return 'tool';
    default:
      return 'user';
  }
}

/**
 * Normalizes a reasoning profile based on model capabilities.
 * Ensures the agent never requests a profile that will cause a provider error.
 */
export function normalizeProfile(
  requested: ReasoningProfile,
  capabilities: ICapabilities,
  modelId: string
): ReasoningProfile {
  if (capabilities.supportedReasoningProfiles.includes(requested)) {
    return requested;
  }

  const profileLadder = [
    ReasoningProfile.DEEP,
    ReasoningProfile.THINKING,
    ReasoningProfile.STANDARD,
    ReasoningProfile.FAST,
  ];

  const startIndex = profileLadder.indexOf(requested);
  for (let i = startIndex + 1; i < profileLadder.length; i++) {
    const candidate = profileLadder[i];
    if (capabilities.supportedReasoningProfiles.includes(candidate)) {
      logger.info(
        `Profile ${requested} not supported for ${modelId}, falling back to ${candidate}`
      );
      return candidate;
    }
  }

  return ReasoningProfile.STANDARD;
}

/**
 * Generic effort levels used across OpenAI and OpenRouter.
 */
export const EFFORT_LEVELS = ['minimal', 'low', 'medium', 'high', 'xhigh'];

/**
 * Supported image formats for provider attachments.
 * Consolidated from repeated definitions in bedrock.ts and other providers.
 */
export const SUPPORTED_IMAGE_FORMATS = ['png', 'jpeg', 'gif', 'webp'] as const;

/**
 * Caps a provider-specific effort string based on model limits.
 */
export function capEffort(requested: string, max?: string): string {
  if (!max) return requested;

  const currentIndex = EFFORT_LEVELS.indexOf(requested);
  const maxIndex = EFFORT_LEVELS.indexOf(max);

  if (maxIndex !== -1 && currentIndex > maxIndex) {
    return max;
  }

  return requested;
}

/**
 * Creates a standardized empty response message.
 * Deduplicates empty response handling across all provider implementations.
 */
export function createEmptyResponse(providerName: string): Message {
  return {
    role: MessageRole.ASSISTANT,
    content: `Empty response from ${providerName}.`,
  };
}

/**
 * Parses a config value to integer with a fallback.
 * Deduplicates parseInt(String(value), 10) patterns across the codebase.
 */
export function parseConfigInt(value: unknown, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  const parsed = parseInt(String(value), 10);
  return isNaN(parsed) ? fallback : parsed;
}
