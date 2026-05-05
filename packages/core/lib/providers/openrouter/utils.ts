import {
  ITool,
  Message,
  Attachment,
  ResponseFormat,
} from '../../types/index';
import {
  OPENROUTER_CONSTANTS,
  DEFAULT_DYNAMIC_THRESHOLD,
  OpenRouterContentBlock,
} from './types';

/**
 * Applies model-specific configurations to the OpenRouter request body.
 */
export function applyModelSpecificConfig(
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

/**
 * Creates an OpenRouter content block from an attachment.
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

/**
 * Converts a standard Message to an OpenRouter-compatible message.
 */
export function convertToOpenRouterMessage(message: Message) {
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
