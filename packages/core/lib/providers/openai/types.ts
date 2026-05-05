import {
  ReasoningProfile,
  ResponseFormat,
} from '../../types/index';

/**
 * Internal response structure from OpenAI Responses API.
 */
export interface OpenAIResponse {
  output_text?: string;
  output_thought?: string;
  output?: Array<{
    id?: string;
    type: string;
    call_id?: string;
    name?: string;
    arguments?: string;
    summary?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Effective call options with defaults applied.
 */
export interface EffectiveCallOptions {
  model: string;
  profile: ReasoningProfile;
  workspaceId: string;
  traceId: string;
}

/**
 * Valid content items for message inputs.
 */
export type ContentItem =
  | { type: string; text: string }
  | { type: string; image_url: { url: string } }
  | { type: string; filename: string; file_data: string };

/**
 * Tool configuration for OpenAI API.
 */
export type ToolConfig = {
  type: string;
  server_label?: string;
  connector_id?: string;
  name?: string;
  description?: string;
  parameters?: Record<string, unknown>;
  strict?: boolean;
};

/**
 * Effective response format config.
 */
export interface EffectiveResponseFormat {
  type: string;
  name: string;
  schema: Record<string, unknown>;
  strict: boolean;
  description?: string;
}
