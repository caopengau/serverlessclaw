/**
 * Type definitions for OpenRouter integration.
 */

import { Message } from '../types/index';
import { OPENROUTER_CONSTANTS } from './openrouter-config';

/**
 * Interface for OpenRouter/OpenAI-compatible content blocks.
 */
export interface OpenRouterContentBlock {
  type: (typeof OPENROUTER_CONSTANTS.CONTENT_TYPES)[keyof typeof OPENROUTER_CONSTANTS.CONTENT_TYPES];
  text?: string;
  image_url?: { url: string };
  input_file?: { file_id: string };
}

/**
 * Interface for OpenRouter API response.
 */
export interface OpenRouterResponse {
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
