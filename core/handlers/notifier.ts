import { Resource } from 'sst';
import { DynamoMemory } from '../lib/memory';
import { MessageRole, AttachmentType, ButtonType } from '../lib/types/llm';
import { Attachment } from '../lib/types/agent';
import { logger } from '../lib/logger';
import { extractBaseUserId } from '../lib/utils/agent-helpers';

const memory = new DynamoMemory();

interface NotifierEvent {
  detail: {
    userId: string;
    message: string;
    memoryContexts?: string[];
    sessionId?: string;
    agentName?: string;
    attachments?: Attachment[];
    options?: {
      label: string;
      value: string;
      type?: ButtonType;
    }[];
    /** Optional workspace ID for multi-human notification fan-out. */
    workspaceId?: string;
  };
}

/**
 * Handles outbound messages by syncing context with memory and sending via Telegram.
 * If workspaceId is provided, fans out to all human members with enabled channels.
 *
 * @param event - The Notifier event containing userId, message, and memoryContexts.
 * @returns A promise that resolves when the notification has been processed.
 */
export const handler = async (event: NotifierEvent): Promise<void> => {
  logger.info('[NOTIFIER] Received event:', JSON.stringify(event, null, 2));

  // The event is wrapped by EventBridge, the actual payload is in event.detail
  const payload = event.detail;
  if (!payload || !payload.userId || !payload.message) {
    logger.error('[NOTIFIER] Missing userId or message in OUTBOUND_MESSAGE event');
    return;
  }

  const {
    userId,
    message,
    memoryContexts,
    sessionId,
    agentName,
    attachments,
    options,
    workspaceId,
  } = payload;

  // Defensive Normalization: Ensure we have the base user ID for syncing and Telegram
  const baseUserId = extractBaseUserId(userId);
  logger.info(
    `[NOTIFIER] Normalized User: ${baseUserId} | Session: ${sessionId} | Contexts: ${memoryContexts?.length ?? 0} | Workspace: ${workspaceId ?? 'none'}`
  );

  const contextsToSync = new Set<string>(memoryContexts ?? []);
  contextsToSync.add(baseUserId); // Always sync to the base user history
  if (sessionId) {
    contextsToSync.add(`CONV#${baseUserId}#${sessionId}`);
  }

  for (const contextId of contextsToSync) {
    // 1. Sync context
    try {
      await memory.addMessage(contextId, {
        role: MessageRole.ASSISTANT,
        content: message,
        agentName: agentName,
        attachments: attachments,
        options: options,
      });
    } catch (e) {
      logger.error(`Failed to sync context to ${contextId}:`, e);
    }
  }

  // 2. Workspace fan-out: send to ALL human members with enabled channels
  if (workspaceId) {
    await sendToWorkspace(workspaceId, message, attachments, options);
    return;
  }

  // 3. Single-user Telegram adapter (legacy path)
  await sendToSingleUser(baseUserId, message, attachments, options);
};

/**
 * Fans out a notification to all human members of a workspace.
 */
async function sendToWorkspace(
  workspaceId: string,
  message: string,
  attachments?: Attachment[],
  options?: { label: string; value: string }[]
): Promise<void> {
  try {
    const { getWorkspace, getHumanMembersWithChannels } =
      await import('../lib/memory/workspace-operations');
    const workspace = await getWorkspace(workspaceId);
    if (!workspace) {
      logger.warn(`[NOTIFIER] Workspace not found: ${workspaceId}`);
      return;
    }

    const humans = getHumanMembersWithChannels(workspace);
    logger.info(`[NOTIFIER] Fan-out to ${humans.length} human members in workspace ${workspaceId}`);

    for (const human of humans) {
      for (const channel of human.channels) {
        if (!channel.enabled) continue;

        try {
          if (channel.platform === 'telegram') {
            if (attachments && attachments.length > 0) {
              for (const attachment of attachments) {
                if (attachment.url) {
                  await sendTelegramMedia(channel.identifier, attachment, message, options);
                }
              }
            } else {
              await sendTelegramMessage(channel.identifier, message, options);
            }
          }
          // Future adapters: discord, slack, email, dashboard
        } catch (err) {
          logger.error(
            `[NOTIFIER] Failed to send to ${human.memberId} via ${channel.platform}:`,
            err
          );
        }
      }
    }
  } catch (err) {
    logger.error(`[NOTIFIER] Workspace fan-out failed for ${workspaceId}:`, err);
  }
}

/**
 * Sends to a single user via Telegram (legacy non-workspace path).
 */
async function sendToSingleUser(
  baseUserId: string,
  message: string,
  attachments?: Attachment[],
  options?: { label: string; value: string }[]
): Promise<void> {
  const isTelegramChatId = /^\d+$/.test(baseUserId);
  if (!isTelegramChatId) {
    logger.info(`[NOTIFIER] Skipping Telegram for non-numeric userId: ${baseUserId}`);
    return;
  }

  if (attachments && attachments.length > 0) {
    for (const attachment of attachments) {
      if (attachment.url) {
        await sendTelegramMedia(baseUserId, attachment, message, options);
      } else {
        logger.warn('Skipping attachment without URL for Telegram:', attachment.name);
      }
    }
  } else {
    await sendTelegramMessage(baseUserId, message, options);
  }
}

/**
 * Sends a message via the Telegram Bot API.
 *
 * @param chatId - The Telegram chat ID to send the message to.
 * @param text - The text of the message to send.
 * @returns A promise that resolves when the message has been sent.
 */
async function sendTelegramMessage(
  chatId: string,
  text: string,
  options?: { label: string; value: string }[]
): Promise<void> {
  try {
    const token = (Resource as unknown as { TelegramBotToken: { value: string } }).TelegramBotToken
      .value;
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: escapeHtml(text),
      parse_mode: 'HTML',
    };

    if (options && options.length > 0) {
      body.reply_markup = {
        inline_keyboard: [options.map((opt) => ({ text: opt.label, callback_data: opt.value }))],
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Telegram API error:', errorText);
    }
  } catch (e) {
    logger.error('Failed to send Telegram message:', e);
  }
}

/**
 * Sends media via the Telegram Bot API.
 */
async function sendTelegramMedia(
  chatId: string,
  attachment: Attachment,
  caption?: string,
  options?: { label: string; value: string }[]
): Promise<void> {
  try {
    const token = (Resource as unknown as { TelegramBotToken: { value: string } }).TelegramBotToken
      .value;

    let method = 'sendDocument';
    let bodyKey = 'document';

    if (attachment.type === AttachmentType.IMAGE) {
      method = 'sendPhoto';
      bodyKey = 'photo';
    }

    const url = `https://api.telegram.org/bot${token}/${method}`;
    const body: Record<string, unknown> = {
      chat_id: chatId,
      [bodyKey]: attachment.url,
      caption: caption ? escapeHtml(caption) : undefined,
      parse_mode: 'HTML',
    };

    if (options && options.length > 0) {
      body.reply_markup = {
        inline_keyboard: [options.map((opt) => ({ text: opt.label, callback_data: opt.value }))],
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Telegram API error (${method}):`, errorText);
    }
  } catch (e) {
    logger.error('Failed to send Telegram media:', e);
  }
}

/**
 * Escapes special characters for Telegram HTML parse mode.
 */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
