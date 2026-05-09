import { BaseMemoryProvider } from '../base';
import { logger } from '../../logger';
import { InsightCategory, MemoryInsight, InsightMetadata } from '../../types/index';
import { applyWorkspaceIsolation } from './isolation';
import { normalizeGapId, getGapIdPK, getGapTimestamp } from './normalization';
import { mapToInsight, createMetadata } from './mapping';

/**
 * Universal fetcher for memory items by their type using the GSI.
 */
export async function getMemoryByTypePaginated(
  base: BaseMemoryProvider,
  type: string,
  limit: number = 100,
  lastEvaluatedKey?: Record<string, unknown>,
  scope?: string | import('../../types/memory').ContextualScope
): Promise<{ items: Record<string, unknown>[]; lastEvaluatedKey?: Record<string, unknown> }> {
  const params: Record<string, unknown> = {
    IndexName: 'TypeTimestampIndex',
    KeyConditionExpression: '#tp = :type',
    ExpressionAttributeNames: { '#tp': 'type' },
    ExpressionAttributeValues: { ':type': type },
    ScanIndexForward: false,
    Limit: limit,
    ExclusiveStartKey: lastEvaluatedKey,
  };
  applyWorkspaceIsolation(params, scope);
  const result = await base.queryItemsPaginated(params);
  return { items: result.items, lastEvaluatedKey: result.lastEvaluatedKey };
}

export async function getMemoryByType(
  base: BaseMemoryProvider,
  type: string,
  limit: number = 100,
  scope?: string | import('../../types/memory').ContextualScope
): Promise<Record<string, unknown>[]> {
  const { items } = await getMemoryByTypePaginated(base, type, limit, undefined, scope);
  return items;
}

/**
 * Resolves a memory item by ID, handling scoping and fallback searches.
 */
export async function resolveItemById(
  base: BaseMemoryProvider,
  id: string,
  type: string,
  scope?: string | import('../../types/memory').ContextualScope
): Promise<MemoryInsight | null> {
  if (!id) return null;
  const normalizedId = normalizeGapId(id);
  const numericMatch = normalizedId.match(/(\d+)$/);
  const numericId = numericMatch ? numericMatch[1] : null;

  const targetPK = type === 'GAP' ? getGapIdPK(normalizedId) : normalizedId;
  const targetSK = type === 'GAP' ? getGapTimestamp(normalizedId) : Number(numericId ?? 0);
  const scopedPK = base.getScopedUserId(targetPK, scope);

  try {
    const items = await base.queryItems({
      KeyConditionExpression: 'userId = :pk AND #ts = :sk',
      ExpressionAttributeNames: { '#ts': 'timestamp' },
      ExpressionAttributeValues: { ':pk': scopedPK, ':sk': targetSK },
    });
    if (items.length > 0) {
      const item = items[0];
      const workspaceId = typeof scope === 'string' ? scope : scope?.workspaceId;
      if (workspaceId && item.workspaceId !== workspaceId) {
        logger.error(`[Security] Cross-workspace access blocked for ${scopedPK}`);
        return null;
      }
      return mapToInsight(item, type);
    }
  } catch (err) {
    logger.debug(`[resolveItemById] Direct lookup failed for ${scopedPK}`, { err });
  }

  try {
    const { items: candidates } = await getMemoryByTypePaginated(base, type, 200, undefined, scope);
    const target = candidates.find((item) => {
      const itemPK = normalizeGapId(item.userId as string);
      const itemTS = (item.timestamp as number | string).toString();
      return (
        itemPK === normalizedId ||
        itemPK.endsWith(`#${numericId}`) ||
        (numericId && itemTS === numericId)
      );
    });
    if (target) return mapToInsight(target, type);
  } catch (error) {
    logger.error(`[resolveItemById] GSI fallback failed:`, error);
  }
  return null;
}

/**
 * Fetches types registered in SYSTEM#REGISTRY.
 */
export async function getRegisteredMemoryTypes(base: BaseMemoryProvider): Promise<string[]> {
  try {
    const items = await base.queryItems({
      KeyConditionExpression: 'userId = :userId AND #ts = :ts',
      ExpressionAttributeNames: { '#ts': 'timestamp' },
      ExpressionAttributeValues: { ':userId': 'SYSTEM#REGISTRY', ':ts': 0 },
    });
    const registry = items[0];
    if (!registry || !registry.activeTypes) return [];
    return Array.from(registry.activeTypes as Iterable<string>);
  } catch (error) {
    logger.error('[getRegisteredMemoryTypes] Error:', error);
    return [];
  }
}

/**
 * Fetches latest content strings for a user.
 */
export async function queryLatestContentByUserId(
  base: BaseMemoryProvider,
  userId: string,
  limit: number = 1
): Promise<string[]> {
  const items = await base.queryItems({
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': userId },
    Limit: limit,
    ScanIndexForward: false,
  });
  return items.map((item) => item.content as string).filter(Boolean);
}

/**
 * Type-based content query utility.
 */
export async function queryByTypeAndGetContent(
  base: BaseMemoryProvider,
  type: string,
  limit: number = 10,
  userId?: string,
  scope?: string | import('../../types/memory').ContextualScope
): Promise<string[]> {
  const params: Record<string, unknown> = {
    Limit: limit,
    ScanIndexForward: false,
    ExpressionAttributeNames: { '#tp': 'type' },
    ExpressionAttributeValues: { ':type': type },
  };
  if (userId) {
    params.IndexName = 'UserInsightIndex';
    params.KeyConditionExpression = 'userId = :userId AND #tp = :type';
    (params.ExpressionAttributeValues as Record<string, unknown>)[':userId'] = base.getScopedUserId(
      userId,
      scope
    );
  } else {
    params.IndexName = 'TypeTimestampIndex';
    params.KeyConditionExpression = '#tp = :type';
    applyWorkspaceIsolation(params, scope);
  }
  const items = await base.queryItems(params);
  return items.map((item) => item.content as string).filter(Boolean);
}

/**
 * Map-and-fetch utility for memory list operations.
 */
export async function queryByTypeAndMap(
  base: BaseMemoryProvider,
  type: string,
  defaultCategory: InsightCategory,
  limit: number = 100,
  filterExpression?: string,
  expressionAttributeValues?: Record<string, unknown>,
  userId?: string,
  scope?: string | import('../../types/memory').ContextualScope
): Promise<MemoryInsight[]> {
  const params: Record<string, unknown> = {
    Limit: limit,
    ScanIndexForward: false,
    ExpressionAttributeValues: { ...expressionAttributeValues },
  };
  if (userId) {
    params.IndexName = 'UserInsightIndex';
    params.KeyConditionExpression = 'userId = :userId AND #tp = :type';
    params.ExpressionAttributeNames = { '#tp': 'type' };
    (params.ExpressionAttributeValues as Record<string, unknown>)[':userId'] = base.getScopedUserId(
      userId,
      scope
    );
    (params.ExpressionAttributeValues as Record<string, unknown>)[':type'] = type;
  } else {
    params.IndexName = 'TypeTimestampIndex';
    params.KeyConditionExpression = '#tp = :type';
    params.ExpressionAttributeNames = { '#tp': 'type' };
    (params.ExpressionAttributeValues as Record<string, unknown>)[':type'] = type;
    applyWorkspaceIsolation(params, scope);
    if (filterExpression) {
      params.FilterExpression = params.FilterExpression
        ? `${params.FilterExpression as string} AND (${filterExpression})`
        : filterExpression;
    }
  }
  const items = await base.queryItems(params);
  return items.map((item) => ({
    id: item['userId'] as string,
    type: (item['type'] as string) || (defaultCategory as string),
    content: item['content'] as string,
    timestamp: item['timestamp'] as number | string,
    workspaceId: item['workspaceId'] as string | undefined,
    createdAt:
      (item['createdAt'] as number) ||
      (typeof item['timestamp'] === 'number'
        ? item['timestamp']
        : parseInt(item['timestamp'] as string, 10)) ||
      Date.now(),
    metadata: createMetadata(
      (item['metadata'] as Partial<InsightMetadata>) || { category: defaultCategory },
      String(item['timestamp'])
    ),
  }));
}
