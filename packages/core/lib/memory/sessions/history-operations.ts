import { Message } from '../../types/llm';
import { RetentionManager } from '../tiering';
import type { BaseMemoryProvider } from '../base';
import { filterPIIFromObject } from '../../utils/pii';
import { logger } from '../../logger';

/**
 * Appends a new message with tiered retention.
 */
export async function addMessage(
  base: BaseMemoryProvider,
  userId: string,
  message: Message,
  scope?: string | import('../../types/memory').ContextualScope
): Promise<void> {
  const scopedUserId = base.getScopedUserId(userId, scope);
  const { expiresAt, type } = await RetentionManager.getExpiresAt('MESSAGES', scopedUserId);
  const scrubbedMessage = filterPIIFromObject(message);

  let workspaceId: string | undefined;
  if (typeof scope === 'string') {
    workspaceId = scope;
  } else if (scope) {
    workspaceId = scope.workspaceId;
  }

  let attempts = 0;
  let success = false;
  const now = Date.now();

  while (attempts < 5 && !success) {
    try {
      // Use micro-timestamp (ms * 1000) + entropy to ensure uniqueness and chronological order
      const timestamp = now * 1000 + (attempts > 0 ? attempts : Math.floor(Math.random() * 1000));

      await base.putItem(
        {
          userId: scopedUserId,
          timestamp,
          createdAt: now,
          type,
          expiresAt,
          workspaceId: workspaceId || undefined,
          ...scrubbedMessage,
        },
        {
          ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(#ts)',
          ExpressionAttributeNames: { '#ts': 'timestamp' },
        }
      );
      success = true;
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'ConditionalCheckFailedException') {
        attempts++;
      } else {
        throw e;
      }
    }
  }

  if (!success) {
    logger.error(`[History] Failed to add message after ${attempts} attempts (collision risk).`);
  }
}

/**
 * Deletes a conversation session and its history.
 */
export async function deleteConversation(
  base: BaseMemoryProvider,
  userId: string,
  sessionId: string,
  scope?: string | import('../../types/memory').ContextualScope
): Promise<void> {
  const normalizedUserId = userId.replace(/^(SESSIONS#)+/, '');
  const conversations = await base.listConversations(normalizedUserId, scope);
  const existing = conversations.find((c) => c.sessionId === sessionId);

  if (existing) {
    const scopedSessionsId = base.getScopedUserId(`SESSIONS#${normalizedUserId}`, scope);
    await base.deleteItem({
      userId: scopedSessionsId,
      timestamp: existing.updatedAt as number | string,
    });
  }

  await base.clearHistory(`CONV#${normalizedUserId}#${sessionId}`, scope);
}

/**
 * Updates distilled memory with a 2-year retention policy.
 */
export async function updateDistilledMemory(
  base: BaseMemoryProvider,
  userId: string,
  facts: string,
  scope?: string | import('../../types/memory').ContextualScope
): Promise<void> {
  const normalizedUserId = userId.replace(/^(DISTILLED#)+/, '');
  const scopedUserId = base.getScopedUserId(`DISTILLED#${normalizedUserId}`, scope);
  const { expiresAt } = await RetentionManager.getExpiresAt('DISTILLED', normalizedUserId);

  let workspaceId: string | undefined;
  if (typeof scope === 'string') {
    workspaceId = scope;
  } else if (scope) {
    workspaceId = scope.workspaceId;
  }

  await base.updateItem({
    Key: {
      userId: scopedUserId,
      timestamp: 0,
    },
    UpdateExpression: 'SET #tp = :type, expiresAt = :exp, content = :content, workspaceId = :wid',
    ExpressionAttributeNames: { '#tp': 'type' },
    ExpressionAttributeValues: {
      ':type': 'DISTILLED',
      ':exp': expiresAt,
      ':content': facts,
      ':wid': workspaceId || 'global',
    },
  });
}
