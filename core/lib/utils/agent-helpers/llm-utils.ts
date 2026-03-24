/**
 * LLM Response Parsing Utilities
 *
 * Common utilities for parsing LLM responses.
 * Extracted from agent-helpers.ts to improve modularity.
 */

import { logger } from '../../logger';

/**
 * Parse a structured JSON response from an LLM, with fallback for markdown-wrapped JSON.
 * This is used by agents to ensure reliability across different providers and models.
 *
 * @param rawResponse - The raw string response from the LLM to parse as JSON.
 * @returns The parsed JSON object of type T.
 */
export function parseStructuredResponse<T>(rawResponse: string): T {
  // Pre-clean: strip [TOOL_CALL]...[/TOOL_CALL] blocks the LLM may embed
  // when it references tools it intended to call but couldn't execute.
  const cleaned = rawResponse.replace(/\[TOOL_CALL\][\s\S]*?\[\/TOOL_CALL\]/g, '').trim();

  try {
    // 1. Try direct parsing
    return JSON.parse(cleaned) as T;
  } catch {
    // 2. Try cleaning potential markdown formatting
    try {
      const jsonContent = cleaned.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(jsonContent) as T;
    } catch (innerE) {
      logger.error('Failed to parse structured response:', {
        raw: rawResponse,
        error: (innerE as Error).message,
      });
      throw new Error(
        `Failed to parse structured response from LLM: ${(innerE as Error).message}`,
        {
          cause: innerE,
        }
      );
    }
  }
}
