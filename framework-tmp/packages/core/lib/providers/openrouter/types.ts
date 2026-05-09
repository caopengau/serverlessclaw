import { ReasoningProfile } from '../../types/index';

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const PROJECT_REFERER = 'https://github.com/serverlessclaw/serverlessclaw';
export const PROJECT_TITLE = 'Serverless Claw';
export const DEFAULT_DYNAMIC_THRESHOLD = 0.3;

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

export const CONTEXT_WINDOWS: Record<string, number> = {
  [OPENROUTER_CONSTANTS.MODELS.GEMINI_3]: 1048576,
  [OPENROUTER_CONSTANTS.MODELS.GLM]: 200000,
  default: 128000,
};

export const OPENROUTER_REASONING_MAP: Record<
  ReasoningProfile,
  { effort: 'low' | 'medium' | 'high'; enabled: boolean; route: 'latency' | 'fallback' }
> = {
  [ReasoningProfile.FAST]: { effort: 'low', enabled: false, route: 'latency' },
  [ReasoningProfile.STANDARD]: { effort: 'low', enabled: true, route: 'fallback' },
  [ReasoningProfile.THINKING]: { effort: 'medium', enabled: true, route: 'fallback' },
  [ReasoningProfile.DEEP]: { effort: 'high', enabled: true, route: 'fallback' },
};

export interface OpenRouterContentBlock {
  type: (typeof OPENROUTER_CONSTANTS.CONTENT_TYPES)[keyof typeof OPENROUTER_CONSTANTS.CONTENT_TYPES];
  text?: string;
  image_url?: { url: string };
  input_file?: { file_id: string };
}

export interface OpenRouterResponse {
  choices?: {
    message?: {
      role: string;
      content: string | null;
      tool_calls?: any[];
      reasoning_details?: Array<{ text?: string }>;
      reasoning?: string;
    };
    delta?: {
      role?: string;
      content?: string | null;
      tool_calls?: any[];
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
