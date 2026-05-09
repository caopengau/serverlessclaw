import {
  Message as BedrockMessage,
  ContentBlock,
  ToolResultContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import { Message, MessageRole, Attachment } from '../../types/index';
import { SUPPORTED_IMAGE_FORMATS } from '../utils';

export const BEDROCK_CONSTANTS = {
  ROLES: {
    USER: 'user' as const,
    ASSISTANT: 'assistant' as const,
  },
  DOC_FORMATS: {
    PDF: 'pdf' as const,
    CSV: 'csv' as const,
    DOC: 'doc' as const,
    DOCX: 'docx' as const,
    XLS: 'xls' as const,
    XLSX: 'xlsx' as const,
    HTML: 'html' as const,
    TXT: 'txt' as const,
    MD: 'md' as const,
  },
  IMG_FORMATS: {
    PNG: 'png' as const,
    JPEG: 'jpeg' as const,
    GIF: 'gif' as const,
    WEBP: 'webp' as const,
  },
  TOOL_TYPES: {
    COMPUTER_USE: 'computer_use',
    FUNCTION: 'function',
  },
  TOOL_NAMES: {
    COMPUTER: 'computer',
  },
  RESPONSE_FORMATS: {
    JSON: 'json' as const,
    JSON_SCHEMA: 'json_schema',
  },
} as const;

export type BedrockDocFormat =
  (typeof BEDROCK_CONSTANTS.DOC_FORMATS)[keyof typeof BEDROCK_CONSTANTS.DOC_FORMATS];

function createAttachmentBlock(
  attachment: Attachment
): ContentBlock | ToolResultContentBlock | null {
  const format = (
    attachment.mimeType?.split('/')[1] ?? BEDROCK_CONSTANTS.IMG_FORMATS.PNG
  ).toLowerCase();

  if (
    attachment.type === 'image' &&
    (SUPPORTED_IMAGE_FORMATS as readonly string[]).includes(format)
  ) {
    return {
      image: {
        format:
          format as (typeof BEDROCK_CONSTANTS.IMG_FORMATS)[keyof typeof BEDROCK_CONSTANTS.IMG_FORMATS],
        source: {
          bytes: attachment.base64 ? Buffer.from(attachment.base64, 'base64') : new Uint8Array(),
        },
      },
    };
  }

  if (attachment.type === 'file') {
    const docFormat = format as BedrockDocFormat;
    return {
      document: {
        name: attachment.name ?? 'document',
        format: docFormat,
        source: {
          bytes: attachment.base64 ? Buffer.from(attachment.base64, 'base64') : new Uint8Array(),
        },
      },
    } as unknown as ContentBlock;
  }

  return null;
}

export function convertToBedrockMessage(message: Message): BedrockMessage {
  const role =
    message.role === MessageRole.ASSISTANT
      ? BEDROCK_CONSTANTS.ROLES.ASSISTANT
      : BEDROCK_CONSTANTS.ROLES.USER;

  const content: ContentBlock[] = [{ text: message.content || '' }];

  const attachments = message.attachments || [];
  const tool_calls = message.tool_calls || [];

  if (attachments.length > 0 && message.role !== MessageRole.TOOL) {
    attachments.forEach((attachment) => {
      const block = createAttachmentBlock(attachment);
      if (block) content.push(block as ContentBlock);
    });
  }

  if (tool_calls.length > 0) {
    tool_calls.forEach((toolCall) => {
      content.push({
        toolUse: {
          toolUseId: toolCall.id,
          name: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments),
        },
      });
    });
  }

  if (message.role === MessageRole.TOOL) {
    const toolContent: ToolResultContentBlock[] = [{ text: message.content || '' }];

    if (attachments.length > 0) {
      attachments.forEach((attachment) => {
        const block = createAttachmentBlock(attachment);
        if (block) toolContent.push(block as ToolResultContentBlock);
      });
    }

    content.push({
      toolResult: {
        toolUseId: message.tool_call_id!,
        content: toolContent,
        status: 'success',
      },
    });
  }

  return { role, content };
}
