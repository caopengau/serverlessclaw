import { ConversationMeta } from '../../types/memory';
import { RetentionManager } from '../tiering';
import type { BaseMemoryProvider } from '../base';
import { RETENTION } from '../../constants/memory';
import { sessionIdToSortKey, fnv1aHash } from '../../utils/id-generator';

/**
 * Saves or updates session metadata.
 */
export async function saveConversationMeta(
  base: BaseMemoryProvider,
  userId: string,
  sessionId: string,
  meta: Partial<ConversationMeta>,
  scope?: string | import('../../types/memory').ContextualScope
): Promise<void> {
  const normalizedUserId = userId.replace(/^(SESSIONS#)+/, '');
  const { type } = await RetentionManager.getExpiresAt('SESSIONS', normalizedUserId);

  const partitionKey = base.getScopedUserId(`SESSIONS#${normalizedUserId}`, scope);
  const sortKeyBase = sessionIdToSortKey(sessionId);
  let stableSortKey = sortKeyBase;

  const existingItems = await base.queryItems({
    KeyConditionExpression: 'userId = :pk AND #ts = :ts',
    ExpressionAttributeNames: { '#ts': 'timestamp' },
    ExpressionAttributeValues: { ':pk': partitionKey, ':ts': stableSortKey },
  });

  const existing = existingItems.length > 0 ? existingItems[0] : null;
  if (existing && (existing.sessionId as string | undefined) && existing.sessionId !== sessionId) {
    stableSortKey = Number(fnv1aHash(sessionId));
  }

  const updateExprParts: string[] = [
    'sessionId = :sessionId',
    '#tp = :type',
    'updatedAt = :now',
    'updatedAtNumeric = :now',
  ];
  const attrNames: Record<string, string> = { '#tp': 'type' };
  const attrValues: Record<string, unknown> = {
    ':sessionId': sessionId,
    ':type': type,
    ':now': meta.updatedAt ?? Date.now(),
  };

  if (meta.isPinned !== undefined) {
    updateExprParts.push('isPinned = :pinned');
    attrValues[':pinned'] = meta.isPinned;
    if (meta.isPinned) {
      const maxPinnedTTLSeconds = RETENTION.MAX_PINNED_SESSION_DAYS * 24 * 60 * 60;
      attrValues[':exp'] = Math.floor(Date.now() / 1000) + maxPinnedTTLSeconds;
    } else {
      const retention = await RetentionManager.getExpiresAt('SESSIONS', normalizedUserId);
      attrValues[':exp'] = retention.expiresAt;
    }
    updateExprParts.push('expiresAt = :exp');
  }

  if (meta.title !== undefined) {
    updateExprParts.push('title = :title');
    attrValues[':title'] = meta.title;
  }
  if (meta.lastMessage !== undefined) {
    updateExprParts.push('content = :content');
    attrValues[':content'] = meta.lastMessage;
  }
  if (meta.mission !== undefined) {
    updateExprParts.push('mission = :mission');
    attrValues[':mission'] = meta.mission;
  }

  let workspaceId: string | undefined;
  if (typeof scope === 'string') {
    workspaceId = scope;
  } else if (scope) {
    workspaceId = scope.workspaceId;
  }
  if (workspaceId) {
    updateExprParts.push('workspaceId = :workspaceId');
    attrValues[':workspaceId'] = workspaceId;
  }

  if (!existing) {
    if (meta.title === undefined) {
      updateExprParts.push('title = :defaultTitle');
      attrValues[':defaultTitle'] = 'New Conversation';
    }
    if (meta.lastMessage === undefined) {
      updateExprParts.push('content = :defaultContent');
      attrValues[':defaultContent'] = '';
    }
    if (meta.isPinned === undefined) {
      updateExprParts.push('isPinned = :defaultPinned');
      attrValues[':defaultPinned'] = false;
      const retention = await RetentionManager.getExpiresAt('SESSIONS', normalizedUserId);
      updateExprParts.push('expiresAt = :defaultExp');
      attrValues[':defaultExp'] = retention.expiresAt;
    }
  }

  await base.updateItem({
    Key: { userId: partitionKey, timestamp: stableSortKey },
    UpdateExpression: `SET ${updateExprParts.join(', ')}`,
    ExpressionAttributeNames: attrNames,
    ExpressionAttributeValues: attrValues,
  });
}

/**
 * Retrieves metadata for a specific conversation session.
 */
export async function getSessionMetadata(
  base: BaseMemoryProvider,
  sessionId: string,
  scope?: string | import('../../types/memory').ContextualScope
): Promise<ConversationMeta | null> {
  const pk = base.getScopedUserId(`SESSIONS#${sessionId}`, scope);
  const sortKey = sessionIdToSortKey(sessionId);

  const items = await base.queryItems({
    KeyConditionExpression: 'userId = :pk AND #ts = :ts',
    ExpressionAttributeNames: { '#ts': 'timestamp' },
    ExpressionAttributeValues: { ':pk': pk, ':ts': sortKey },
  });

  const item = items[0];
  if (!item) return null;

  return {
    sessionId: item.sessionId as string,
    title: item.title as string,
    lastMessage: item.content as string,
    updatedAt: item.timestamp as number | string,
    isPinned: !!item.isPinned,
    expiresAt: item.expiresAt as number | undefined,
    mission: item.mission as any,
    workspaceId: item.workspaceId as string,
    metadata: item.metadata as any,
  };
}
