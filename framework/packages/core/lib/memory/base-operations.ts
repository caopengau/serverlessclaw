import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../logger';
import { Message, MessageRole, createMessage } from '../types/llm';
import { ConversationMeta } from '../types/memory';
import { BaseMemoryProvider } from './base';

/**
 * Standard implementation for getHistory.
 * Filters out expired items based on TTL.
 */
export async function getHistory(
  base: BaseMemoryProvider,
  userId: string,
  scope?: string | import('../types/memory').ContextualScope
): Promise<Message[]> {
  const scopedUserId = base.getScopedUserId(userId, scope);
  const items = await base.queryItems({
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': scopedUserId,
    },
    ScanIndexForward: true, // Oldest first
  });

  const now = Math.floor(Date.now() / 1000);
  const validItems = (items || []).filter(
    (item) => !item.expiresAt || (item.expiresAt as number) > now
  );

  return validItems.map((item) =>
    createMessage({
      role: (item.role as MessageRole) || MessageRole.ASSISTANT,
      content: (item.content as string) || '',
      thought: (item.thought as string) || '',
      tool_calls: (item.tool_calls as any[]) || [],
      attachments: (item.attachments as any[]) || [],
      tool_call_id: item.tool_call_id as string,
      name: item.name as string,
      agentName: (item.agentName as string) || 'SYSTEM',
      traceId: (item.traceId as string) || `legacy-${item.timestamp || Date.now()}`,
      messageId: (item.messageId as string) || `msg-legacy-${item.timestamp || Date.now()}`,
      workspaceId: (item.workspaceId as string) || 'default',
    })
  );
}

/**
 * Standard implementation for clearHistory.
 */
export async function clearHistory(
  base: BaseMemoryProvider,
  userId: string,
  scope?: string | import('../types/memory').ContextualScope
): Promise<void> {
  const tableName = base.getTableName();
  if (!tableName) return;

  const scopedUserId = base.getScopedUserId(userId, scope);
  const items = await base.queryItems({
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': scopedUserId,
    },
  });

  if (items.length === 0) return;

  for (let i = 0; i < items.length; i += 25) {
    const batch = items.slice(i, i + 25);
    let requestItems: any = {
      [tableName]: batch.map((item) => ({
        DeleteRequest: {
          Key: { userId: item.userId as string, timestamp: item.timestamp as number },
        },
      })),
    };

    let attempts = 0;
    const MAX_ATTEMPTS = 5;

    while (Object.keys(requestItems).length > 0 && attempts < MAX_ATTEMPTS) {
      if (attempts > 0) {
        const delay = Math.pow(2, attempts) * 100 + Math.random() * 100;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const response = await base
        .getDocClient()
        .send(new BatchWriteCommand({ RequestItems: requestItems }));
      requestItems = (response.UnprocessedItems as typeof requestItems) || {};
      attempts++;
    }
  }
  logger.info(`Cleared history for ${scopedUserId} (${items.length} items)`);
}

/**
 * Standard implementation for getDistilledMemory.
 */
export async function getDistilledMemory(
  base: BaseMemoryProvider,
  userId: string,
  scope?: string | import('../types/memory').ContextualScope
): Promise<string> {
  const scopedDistilledId = base.getScopedUserId(`DISTILLED#${userId}`, scope);
  const items = await base.queryItems({
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': scopedDistilledId,
    },
    ScanIndexForward: false,
    Limit: 1,
  });

  return (items?.[0]?.content as string) || '';
}

/**
 * Standard implementation for listConversations.
 */
export async function listConversations(
  base: BaseMemoryProvider,
  userId: string,
  scope?: string | import('../types/memory').ContextualScope
): Promise<ConversationMeta[]> {
  const scopedSessionsId = base.getScopedUserId(`SESSIONS#${userId}`, scope);
  const items = await base.queryItems({
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': scopedSessionsId,
    },
    ScanIndexForward: false,
  });

  return items.map((item) => ({
    sessionId: (item.sessionId as string) || '',
    title: (item.title as string) || 'Untitled',
    lastMessage: (item.content as string) || '',
    updatedAt: (item.timestamp as number) || Date.now(),
    isPinned: !!item.isPinned,
    expiresAt: item.expiresAt as number,
  }));
}
