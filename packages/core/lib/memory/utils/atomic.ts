import { BaseMemoryProvider } from '../base';
import { logger } from '../../logger';
import { InsightMetadata } from '../../types/index';
import { normalizeTags } from './normalization';

/**
 * Updates an item's fields and metadata atomically while enforcing workspace boundaries.
 */
export async function atomicUpdateMetadata(
  base: BaseMemoryProvider,
  userId: string,
  timestamp: number | string,
  metadata: Partial<InsightMetadata & { content?: string; tags?: string[] }>,
  scope?: string | import('../../types/memory').ContextualScope
): Promise<void> {
  const pk = base.getScopedUserId(userId, scope);
  const metadataFields: string[] = [
    'category',
    'confidence',
    'impact',
    'complexity',
    'risk',
    'urgency',
    'priority',
    'hitCount',
    'lastAccessed',
    'retryCount',
    'lastAttemptTime',
    'createdAt',
    'sessionId',
    'requestingUserId',
  ];

  const updates: string[] = [];
  const updateValues: Record<string, unknown> = { ':now': Date.now() };
  const attributeNames: Record<string, string> = {};

  if (metadata.content !== undefined) {
    updates.push('#content = :content');
    updateValues[':content'] = metadata.content;
    attributeNames['#content'] = 'content';
  }
  if (metadata.tags !== undefined) {
    updates.push('#tags = :tags');
    updateValues[':tags'] = normalizeTags(metadata.tags);
    attributeNames['#tags'] = 'tags';
  }

  for (const field of metadataFields) {
    if ((metadata as Record<string, unknown>)[field] !== undefined) {
      updates.push(`metadata.#${field} = :${field}`);
      updateValues[`:${field}`] = (metadata as Record<string, unknown>)[field];
      attributeNames[`#${field}`] = field;
    }
  }

  if (updates.length === 0) return;

  try {
    const params: Record<string, unknown> = {
      Key: { userId: pk, timestamp: Number(timestamp) },
      UpdateExpression: `SET updatedAt = :now, ${updates.join(', ')}`,
      ExpressionAttributeValues: updateValues,
    };
    if (Object.keys(attributeNames).length > 0) {
      params.ExpressionAttributeNames = attributeNames;
    }
    await base.updateItem(params);
  } catch (error) {
    logger.error(`[atomicUpdateMetadata] Failed update for ${pk}:`, error);
    throw error;
  }
}

/**
 * Atomically increments a numeric counter field in an item.
 */
export async function atomicIncrement(
  base: BaseMemoryProvider,
  userId: string,
  timestamp: number | string,
  field: string,
  nestedInMetadata: boolean = true
): Promise<number> {
  const fieldPath = nestedInMetadata ? `metadata.#field` : `#field`;
  const attrNames = { '#field': field };
  const attrValues = { ':zero': 0, ':one': 1, ':now': Date.now() };

  try {
    const result = await base.updateItem({
      Key: { userId, timestamp: Number(timestamp) },
      UpdateExpression: `SET ${fieldPath} = if_not_exists(${fieldPath}, :zero) + :one, updatedAt = :now`,
      ExpressionAttributeNames: attrNames,
      ExpressionAttributeValues: attrValues,
      ReturnValues: 'ALL_NEW',
    });
    const attributes = result?.Attributes as Record<string, unknown> | undefined;
    if (!attributes) return 0;
    const val = nestedInMetadata
      ? (attributes.metadata as Record<string, number> | undefined)?.[field]
      : (attributes[field] as number | undefined);
    return val || 0;
  } catch (error) {
    logger.error(`[atomicIncrement] Failed for ${userId}:`, error);
    throw error;
  }
}

/**
 * Puts an item with a collision retry strategy (timestamp jitter).
 */
export async function putWithCollisionRetry(
  base: BaseMemoryProvider,
  item: Record<string, unknown>,
  maxRetries: number = 5
): Promise<void> {
  let retryCount = 0;
  const baseTimestamp = (item.timestamp as number) || Date.now();

  while (retryCount < maxRetries) {
    try {
      await base.putItem({
        ...item,
        timestamp: baseTimestamp + retryCount,
        ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(#ts)',
        ExpressionAttributeNames: { '#ts': 'timestamp' },
      });
      return;
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'ConditionalCheckFailedException') {
        retryCount++;
        continue;
      }
      throw e;
    }
  }
  throw new Error(`Max retries reached for putWithCollisionRetry: ${item.userId}`);
}
