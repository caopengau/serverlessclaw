import { BaseMemoryProvider } from '../base';
import {
  InsightCategory,
  ContextualScope,
  MemoryInsight,
  InsightMetadata,
} from '../../types/memory';
import { resolveScopeId, applyWorkspaceIsolation } from '../utils';
import { createMetadata, normalizeTags } from './common';
import { searchInsights } from './query-operations';

/**
 * Retrieves failure patterns to identify recurring systemic issues.
 */
export async function getFailurePatterns(
  base: BaseMemoryProvider,
  limit: number = 10,
  scope?: string | ContextualScope
): Promise<MemoryInsight[]> {
  const { items } = await searchInsights(
    base,
    { category: InsightCategory.FAILURE_PATTERN, limit },
    undefined,
    undefined,
    limit,
    undefined,
    undefined,
    undefined,
    scope
  );
  return items;
}

/**
 * Records a recurring failure pattern for metabolic analysis.
 */
export async function recordFailurePattern(
  base: BaseMemoryProvider,
  planHash: string,
  planContent: string,
  gapIds: string[],
  failureReason: string,
  metadata?: Partial<InsightMetadata> & { orgId?: string; tags?: string[] },
  scope?: string | ContextualScope
): Promise<string | number> {
  const timestamp = String(Date.now());
  const content = JSON.stringify({ planHash, planContent, gapIds, failureReason });
  const pk = base.getScopedUserId('SYSTEM#GLOBAL', scope);
  const workspaceId = resolveScopeId(scope);

  await base.putItem({
    userId: pk,
    timestamp,
    type: 'MEMORY:FAILURE_PATTERN',
    tags: normalizeTags(['failed_plan', ...(metadata?.tags ?? [])]),
    content,
    createdAt: parseInt(timestamp, 10),
    metadata: createMetadata(metadata, timestamp),
    workspaceId,
  });
  return timestamp;
}

/**
 * Retrieves memory items with low utilization for metabolic analysis.
 */
export async function getLowUtilizationMemory(
  base: BaseMemoryProvider,
  limit: number = 20,
  scope?: string | ContextualScope
): Promise<Record<string, unknown>[]> {
  const staleThresholdMs = 14 * 24 * 60 * 60 * 1000; // 14 days
  const now = Date.now();
  const workspaceId = resolveScopeId(scope);

  const registryItems = await base.queryItems({
    KeyConditionExpression: 'userId = :pk AND #ts = :zero',
    ExpressionAttributeNames: { '#ts': 'timestamp' },
    ExpressionAttributeValues: { ':pk': 'SYSTEM#REGISTRY', ':zero': 0 },
  });
  const types: string[] = (registryItems[0]?.activeTypes as string[]) ?? [];

  if (types.length === 0) return [];

  const allItems: Record<string, unknown>[] = [];
  for (const type of types) {
    const params: any = {
      IndexName: 'TypeTimestampIndex',
      KeyConditionExpression: '#tp = :type',
      ExpressionAttributeNames: { '#tp': 'type' },
      ExpressionAttributeValues: { ':type': type },
      Limit: limit,
    };
    applyWorkspaceIsolation(params, scope);

    const typeItems = await base.queryItems(params);
    allItems.push(...(typeItems as Record<string, unknown>[]));
  }

  return allItems.filter((item) => {
    const meta = item['metadata'] as Record<string, unknown> | undefined;
    const hitCount = (meta?.['hitCount'] as number) ?? 0;
    const lastAccessed = (meta?.['lastAccessed'] as number) ?? 0;
    const itemWorkspaceId = item['workspaceId'] as string | undefined;

    if (workspaceId && itemWorkspaceId !== workspaceId) return false;

    return hitCount === 0 && now - lastAccessed > staleThresholdMs;
  });
}
