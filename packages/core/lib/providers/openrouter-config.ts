/**
 * OpenRouter configuration constants and mappings.
 * Centralizes all constant values used across the provider for consistency.
 */

import { ReasoningProfile } from '../types/index';

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const PROJECT_REFERER = process.env.PROJECT_REFERER || 'https://github.com/framework/core';
export const PROJECT_TITLE = process.env.PROJECT_TITLE || 'AI Framework Assistant';
export const DEFAULT_DYNAMIC_THRESHOLD = 0.3;

/**
 * Standardized OpenRouter values for type safety and AI signal clarity.
 */
export const OPENROUTER_CONSTANTS = {
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

/**
 * Known context windows for specific models to avoid magic numbers.
 */
export const CONTEXT_WINDOWS: Record<string, number> = {
  [OPENROUTER_CONSTANTS.MODELS.GEMINI_3]: 1048576,
  [OPENROUTER_CONSTANTS.MODELS.GLM]: 200000,
  default: 128000,
};

/**
 * Mapping of reasoning profiles to OpenRouter-specific reasoning parameters.
 */
export const OPENROUTER_REASONING_MAP: Record<
  ReasoningProfile,
  { effort: 'low' | 'medium' | 'high'; enabled: boolean; route: 'latency' | 'fallback' }
> = {
  [ReasoningProfile.FAST]: { effort: 'low', enabled: false, route: 'latency' },
  [ReasoningProfile.STANDARD]: { effort: 'low', enabled: true, route: 'fallback' },
  [ReasoningProfile.THINKING]: { effort: 'medium', enabled: true, route: 'fallback' },
  [ReasoningProfile.DEEP]: { effort: 'high', enabled: true, route: 'fallback' },
};
