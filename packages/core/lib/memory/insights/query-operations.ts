import { BaseMemoryProvider } from '../base';
import {
  MemoryInsight,
  InsightCategory,
  ContextualScope,
  InsightMetadata,
} from '../../types/memory';
import { resolveScopeId, applyWorkspaceIsolation } from '../utils';
import { normalizeTags } from './common';

/**
 * Helper to query by type and map results to MemoryInsight[].
 */
export async function queryByTypeAndMap(
  base: BaseMemoryProvider,
  params: Record<string, unknown>
): Promise<MemoryInsight[]> {
  const items = await base.queryItems(params);
  return items.map((item) => ({
    id: (item['userId'] as string) || 'unknown',
    userId: item['userId'] as string,
    timestamp: item['timestamp'] as string | number,
    createdAt: item['createdAt'] as number | undefined,
    type: (item['type'] as string) || 'MEMORY:INSIGHT',
    content: (item['content'] as string) || '',
    tags: (item['tags'] as string[]) || [],
    metadata: (item['metadata'] as InsightMetadata) || {
      category: InsightCategory.SYSTEM_KNOWLEDGE,
    },
    workspaceId: item['workspaceId'] as string,
  }));
}

/**
 * Omni-Signature search implementation.
 * Supports legacy positional and modern options-based queries.
 */
export async function searchInsights(
  base: BaseMemoryProvider,
  queryOrUserId?:
    | string
    | {
        query?: string;
        tags?: string[];
        category?: InsightCategory;
        limit?: number;
        scope?: ContextualScope;
        userId?: string;
      },
  queryText?: string,
  category?: InsightCategory,
  limit?: number,
  lastEvaluatedKey?: Record<string, unknown>,
  tags?: string[],
  orgId?: string,
  scope?: string | ContextualScope
): Promise<{ items: MemoryInsight[]; lastEvaluatedKey?: Record<string, unknown> }> {
  // 1. Detect if using modern options-based signature
  let resolvedUserId: string;
  let resolvedQuery: string;
  let resolvedTags = tags;
  let resolvedCategory = category;
  let resolvedLimit = limit || 50;
  let resolvedScope = scope;

  if (queryOrUserId && typeof queryOrUserId === 'object' && !Array.isArray(queryOrUserId)) {
    resolvedUserId = ((queryOrUserId as Record<string, unknown>).userId as string) || '';
    resolvedQuery = ((queryOrUserId as Record<string, unknown>).query as string) || '';
    resolvedTags = queryOrUserId.tags || tags;
    resolvedCategory = queryOrUserId.category || category;
    resolvedLimit = queryOrUserId.limit || limit || 50;
    resolvedScope = queryOrUserId.scope || scope;
  } else {
    resolvedUserId = (queryOrUserId as string) || '';
    resolvedQuery = queryText || '';
  }

  // 2. Build DynamoDB Query Parameters
  const params: Record<string, unknown> = {
    ExpressionAttributeNames: { '#tp': 'type' },
    ExpressionAttributeValues: { ':type': 'MEMORY:INSIGHT' },
  };

  const pk = base.getScopedUserId(resolvedUserId || 'SYSTEM#GLOBAL', resolvedScope);

  if (resolvedUserId) {
    params.IndexName = 'UserInsightIndex';
    params.KeyConditionExpression = '#uid = :userId AND #tp = :type';
    (params.ExpressionAttributeNames as Record<string, string>)['#uid'] = 'userId';
    (params.ExpressionAttributeValues as Record<string, unknown>)[':userId'] = pk;
  } else if (resolvedCategory) {
    params.IndexName = 'TypeTimestampIndex';
    params.KeyConditionExpression = '#tp = :type';
    applyWorkspaceIsolation(params, resolvedScope);
  } else {
    params.IndexName = 'UserInsightIndex';
    params.KeyConditionExpression = 'userId = :pk AND #tp = :type';
    (params.ExpressionAttributeValues as Record<string, unknown>)[':pk'] = pk;
    if (resolvedScope) {
      applyWorkspaceIsolation(params, resolvedScope);
    }
  }

  if (resolvedQuery && resolvedQuery !== '*') {
    const containsExpr = 'contains(content, :query)';
    params.FilterExpression = params.FilterExpression
      ? `(${params.FilterExpression as string}) AND (${containsExpr})`
      : containsExpr;
    (params.ExpressionAttributeValues as Record<string, unknown>)[':query'] = resolvedQuery;
  }

  if (resolvedLimit) params.Limit = resolvedLimit;
  if (lastEvaluatedKey) params.ExclusiveStartKey = lastEvaluatedKey;

  let items: MemoryInsight[];

  if (resolvedUserId && orgId) {
    const queries = [
      queryByTypeAndMap(base, {
        ...params,
        ExpressionAttributeValues: {
          ...(params.ExpressionAttributeValues as Record<string, unknown>),
          ':userId': base.getScopedUserId(resolvedUserId, resolvedScope),
        },
      }),
      queryByTypeAndMap(base, {
        ...params,
        ExpressionAttributeValues: {
          ...(params.ExpressionAttributeValues as Record<string, unknown>),
          ':userId': base.getScopedUserId(`ORG#${orgId}`),
        },
      }),
      queryByTypeAndMap(base, {
        ...params,
        ExpressionAttributeValues: {
          ...(params.ExpressionAttributeValues as Record<string, unknown>),
          ':userId': base.getScopedUserId('SYSTEM#GLOBAL'),
        },
      }),
    ];

    const workspaceId = resolveScopeId(resolvedScope);
    if (workspaceId) {
      queries.push(
        queryByTypeAndMap(base, {
          ...params,
          ExpressionAttributeValues: {
            ...(params.ExpressionAttributeValues as Record<string, unknown>),
            ':userId': base.getScopedUserId(`ORG#${orgId}`, resolvedScope),
          },
        })
      );
      queries.push(
        queryByTypeAndMap(base, {
          ...params,
          ExpressionAttributeValues: {
            ...(params.ExpressionAttributeValues as Record<string, unknown>),
            ':userId': base.getScopedUserId('SYSTEM#GLOBAL', resolvedScope),
          },
        })
      );
    }

    const results = await Promise.all(queries);
    items = results.flatMap((r) => r);
  } else {
    applyWorkspaceIsolation(params, resolvedScope);
    items = await queryByTypeAndMap(base, params);
  }

  let filtered = items;
  if (resolvedTags && resolvedTags.length > 0) {
    const searchTags = normalizeTags(resolvedTags);
    filtered = items.filter((item) => searchTags.some((t) => (item.tags || []).includes(t)));
  }

  if (resolvedCategory) {
    filtered = filtered.filter((item) => item.metadata?.category === resolvedCategory);
  }

  return {
    items: filtered,
  };
}

/**
 * Retrieves recent tactical lessons
 */
export async function getLessons(
  base: BaseMemoryProvider,
  userId: string,
  scope?: string | ContextualScope
): Promise<string[]> {
  const pk = base.getScopedUserId(`USER#${userId}`, scope);

  const items = await queryByTypeAndMap(base, {
    IndexName: 'UserInsightIndex',
    KeyConditionExpression: 'userId = :pk AND #type = :type',
    ExpressionAttributeNames: { '#type': 'type' },
    ExpressionAttributeValues: {
      ':pk': pk,
      ':type': 'MEMORY:INSIGHT',
    },
  });

  return items
    .filter((i) => i.metadata?.category === InsightCategory.TACTICAL_LESSON)
    .map((i) => i.content);
}

/**
 * Retrieves all lessons from the system.
 */
export async function getGlobalLessons(
  base: BaseMemoryProvider,
  limit: number = 20,
  scope?: string | ContextualScope
): Promise<string[]> {
  const pk = base.getScopedUserId('SYSTEM#GLOBAL', scope);

  const items = await queryByTypeAndMap(base, {
    IndexName: 'UserInsightIndex',
    KeyConditionExpression: 'userId = :pk AND #type = :type',
    ExpressionAttributeNames: { '#type': 'type' },
    ExpressionAttributeValues: {
      ':pk': pk,
      ':type': 'MEMORY:INSIGHT',
    },
    Limit: limit,
  });

  return items
    .filter((i) => i.metadata?.category === InsightCategory.SYSTEM_KNOWLEDGE)
    .slice(0, limit)
    .map((i) => i.content);
}
