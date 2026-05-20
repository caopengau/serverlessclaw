/**
 * Helper functions for OpenRouter provider.
 */

import { Message, ITool, Attachment, ResponseFormat } from '../types/index';
import { OPENROUTER_CONSTANTS } from './openrouter-config';
import { OpenRouterContentBlock } from './openrouter-types';

/**
 * Helper to apply model-specific configuration to the request body.
 * Centralizes provider-specific logic to ensure consistency between call() and stream().
 */
export function applyModelSpecificConfig(
  body: Record<string, unknown>,
  activeModel: string,
  tools?: ITool[],
  responseFormat?: ResponseFormat
): void {
  // GLM Specifics
  if (activeModel.includes(OPENROUTER_CONSTANTS.MODELS.GLM)) {
    body['plugin_id'] = 'reasoning';
    body['include_reasoning'] = true;
  }

  // Gemini Specifics
  const isGemini = activeModel.includes(OPENROUTER_CONSTANTS.MODELS.GEMINI_PREFIX);
  const isGemini3 = activeModel.includes(OPENROUTER_CONSTANTS.MODELS.GEMINI_3);

  if (isGemini3) {
    // Force JSON_OBJECT if JSON_SCHEMA requested (Gemini 3 specific quirk)
    if (responseFormat?.type === OPENROUTER_CONSTANTS.RESPONSE_FORMATS.JSON_SCHEMA) {
      body['response_format'] = { type: OPENROUTER_CONSTANTS.RESPONSE_FORMATS.JSON_OBJECT };
    }

    // Safety settings (documented intentional override for evolution autonomy)
    body['safety_settings'] = 'off';
  }

  // Google Search Retrieval (Gemini feature)
  if (isGemini && tools?.some((t) => t.type === OPENROUTER_CONSTANTS.TOOL_TYPES.GOOGLE_SEARCH)) {
    body['google_search_retrieval'] = {
      dynamic_retrieval: { mode: 'unspecified', dynamic_threshold: 0.3 },
    };
  }
}

/**
 * Helper to convert a Claw message to an OpenRouter-compatible message.
 * @param message The input Claw message.
 * @returns A formatted message object.
 */
export function convertToOpenRouterMessage(message: Message): Message {
  if (!message.attachments || message.attachments.length === 0) {
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
        : (content as unknown),
  } as Message;
}

/**
 * Helper to create a content block for OpenRouter.
 * @param attachment The input attachment.
 * @returns A content block or null if unsupported.
 */
export function createContentBlock(attachment: Attachment): OpenRouterContentBlock | null {
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
