import { logger } from '../../logger';
import { BaseMemoryProvider } from '../base';
import { InsightCategory, ContextualScope, InsightMetadata } from '../../types/memory';
import { resolveScopeId } from '../utils';
import { filterPII } from '../../utils/pii';
import { createMetadata, normalizeTags } from './common';

/**
 * Records a localized preference for a specific entity.
 */
export async function setPreference(
  base: BaseMemoryProvider,
  entityId: string,
  content: string,
  metadata?: Partial<InsightMetadata> & { tags?: string[] },
  scope?: string | ContextualScope
): Promise<string> {
  const timestamp = String(Date.now());
  const pk = base.getScopedUserId(entityId, scope);
  const workspaceId = resolveScopeId(scope);

  const metadataObj = createMetadata(
    { ...metadata, category: InsightCategory.USER_PREFERENCE },
    timestamp
  );
  await base.putItem({
    userId: pk,
    timestamp,
    type: 'MEMORY:PREFERENCE',
    tags: normalizeTags(['preference', ...(metadata?.tags ?? [])]),
    content,
    expiresAt: metadataObj.expiresAt,
    createdAt: parseInt(timestamp, 10),
    metadata: metadataObj,
    workspaceId,
  });

  return timestamp;
}

/**
 * Adds a new granular memory item into the user or global scope.
 */
export async function addMemory(
  base: BaseMemoryProvider,
  scopeId: string,
  category: InsightCategory | string,
  content: string,
  metadata?: Partial<InsightMetadata> & { orgId?: string; tags?: string[] },
  scope?: string | ContextualScope
): Promise<number | string> {
  const timestamp = String(Date.now());
  const pk = base.getScopedUserId(scopeId, scope);
  const workspaceId = resolveScopeId(scope);

  const categoryToUse =
    typeof category === 'string' ? category : (category ?? InsightCategory.SYSTEM_KNOWLEDGE);
  const sanitizedContent = filterPII(content || '');

  const existing = await base.queryItems({
    KeyConditionExpression: 'userId = :pk',
    FilterExpression: '#tp = :type AND metadata.category = :cat AND content = :content',
    ExpressionAttributeNames: { '#tp': 'type' },
    ExpressionAttributeValues: {
      ':pk': pk,
      ':type': 'MEMORY:INSIGHT',
      ':cat': categoryToUse,
      ':content': sanitizedContent,
    },
    Limit: 1,
  });

  if (existing.length > 0) {
    const similar = existing[0];
    logger.info(`[Memory] Deduplicated similar content for ${pk}`);
    await recordMemoryHit(base, pk, String(similar.timestamp), scope);
    return similar.timestamp as string;
  }

  const metadataObj = createMetadata(
    {
      ...metadata,
      category: categoryToUse,
    },
    timestamp
  );

  await base.putItem({
    userId: pk,
    timestamp,
    type: 'MEMORY:INSIGHT',
    tags: normalizeTags(metadata?.tags),
    content: sanitizedContent,
    expiresAt: metadataObj.expiresAt,
    createdAt: parseInt(timestamp, 10),
    metadata: metadataObj,
    workspaceId,
  });

  try {
    await base.updateItem({
      Key: { userId: 'SYSTEM#REGISTRY', timestamp: 0 },
      UpdateExpression: 'ADD activeTypes :type',
      ExpressionAttributeValues: { ':type': new Set([categoryToUse]) },
    });
  } catch (e) {
    logger.warn(`Failed to update memory registry for ${pk}: ${e}`);
  }

  return timestamp;
}

/**
 * Atomically increments hit count and updates lastAccessed timestamp.
 */
export async function recordMemoryHit(
  base: BaseMemoryProvider,
  userId: string,
  timestamp: string | number,
  scope?: string | ContextualScope
): Promise<void> {
  const pk = base.getScopedUserId(userId, scope);
  const now = Date.now();

  try {
    await base.updateItem({
      Key: { userId: pk, timestamp },
      UpdateExpression:
        'SET metadata.hitCount = if_not_exists(metadata.hitCount, :zero) + :inc, metadata.lastAccessed = :now',
      ExpressionAttributeValues: {
        ':zero': 0,
        ':inc': 1,
        ':now': now,
      },
      ConditionExpression: 'attribute_exists(userId)',
    });
  } catch (error) {
    logger.warn(`Failed to record memory hit for ${pk}: ${error}`);
  }
}

/**
 * Adds a tactical lesson
 */
export async function addLesson(
  base: BaseMemoryProvider,
  userId: string,
  content: string,
  metadata?: Partial<InsightMetadata>,
  scope?: string | ContextualScope
): Promise<void> {
  const timestamp = String(Date.now());
  const pk = base.getScopedUserId(`USER#${userId}`, scope);
  const workspaceId = resolveScopeId(scope);

  const metadataObj = createMetadata(
    { ...metadata, category: InsightCategory.TACTICAL_LESSON },
    timestamp
  );

  await base.putItem({
    userId: pk,
    timestamp,
    type: 'MEMORY:INSIGHT',
    tags: normalizeTags(['lesson']),
    content,
    expiresAt: metadataObj.expiresAt,
    createdAt: parseInt(timestamp, 10),
    metadata: metadataObj,
    workspaceId,
  });
}

/**
 * Adds a system-wide lesson that benefits ALL users and sessions.
 */
export async function addGlobalLesson(
  base: BaseMemoryProvider,
  lesson: string,
  metadata?: Partial<InsightMetadata>
): Promise<number | string> {
  const timestamp = String(Date.now());
  const pk = base.getScopedUserId('SYSTEM#GLOBAL');

  const metadataObj = createMetadata(
    { ...metadata, category: InsightCategory.SYSTEM_KNOWLEDGE },
    timestamp
  );

  await base.putItem({
    userId: pk,
    timestamp,
    type: 'MEMORY:INSIGHT',
    tags: normalizeTags(['global', 'lesson']),
    content: lesson,
    expiresAt: metadataObj.expiresAt,
    createdAt: parseInt(timestamp, 10),
    metadata: metadataObj,
  });

  return timestamp;
}

/**
 * Standardized update for insight metadata fields.
 */
export async function updateInsightMetadata(
  base: BaseMemoryProvider,
  userId: string,
  timestamp: number | string,
  metadata: Partial<InsightMetadata>,
  scope?: string | ContextualScope
): Promise<void> {
  const pk = base.getScopedUserId(userId, scope);
  const { atomicUpdateMetadata } = await import('../utils');

  return atomicUpdateMetadata(base, pk, timestamp, metadata, scope);
}

/**
 * Refines an existing memory item atomically using UpdateCommand.
 */
export async function refineMemory(
  base: BaseMemoryProvider,
  userId: string,
  timestamp: number | string,
  content?: string,
  metadata?: Partial<InsightMetadata> & { tags?: string[] },
  scope?: string | ContextualScope
): Promise<void> {
  const pk = base.getScopedUserId(userId, scope);
  const now = Date.now();

  const updateExpr: string[] = ['SET updatedAt = :now'];
  const attrNames: Record<string, string> = { '#content': 'content' };
  const attrValues: Record<string, unknown> = { ':now': now };

  if (metadata) {
    Object.entries(metadata).forEach(([key, val]) => {
      if (key === 'tags' && Array.isArray(val)) {
        updateExpr.push('#tags = :tags');
        attrNames['#tags'] = 'tags';
        attrValues[':tags'] = normalizeTags(val);
      } else if (key !== 'tags') {
        const metaKey = `#${key}`;
        const valKey = `:${key}`;
        updateExpr.push(`metadata.${metaKey} = ${valKey}`);
        attrNames[metaKey] = key;
        attrValues[valKey] = val;
      }
    });
  }

  if (content !== undefined) {
    updateExpr.push('#content = :content');
    attrNames['#content'] = 'content';
    attrValues[':content'] = filterPII(content);
  }

  await base.updateItem({
    Key: { userId: pk, timestamp },
    UpdateExpression: updateExpr.join(', '),
    ExpressionAttributeNames: attrNames,
    ExpressionAttributeValues: attrValues,
    ConditionExpression: 'attribute_exists(userId)',
  });
}
