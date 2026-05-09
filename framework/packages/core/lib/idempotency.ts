/**
 * Idempotency utility for critical tool calls.
 * Prevents duplicate side effects from EventBridge at-least-once delivery.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { logger } from './logger';
import { getMemoryTableName } from './utils/ddb-client';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

// Idempotency key TTL: 24 hours
const IDEMPOTENCY_TTL_HOURS = 24;
const IDEMPOTENCY_TTL_SECONDS = IDEMPOTENCY_TTL_HOURS * 60 * 60;

interface IdempotencyRecord {
  idempotencyKey: string;
  result: unknown;
  createdAt: number;
  expiresAt: number;
}

/**
 * Checks if an idempotency key already exists and returns the cached result.
 *
 * @param idempotencyKey - The unique idempotency key for the operation.
 * @param workspaceId - Optional workspace ID for multi-tenant isolation.
 * @returns The cached result if found, null otherwise.
 */
export async function getIdempotentResult(
  idempotencyKey: string,
  workspaceId?: string
): Promise<unknown | null> {
  try {
    const tableName = getMemoryTableName();

    if (!tableName) {
      logger.info('[IDEMPOTENCY] MemoryTable not linked. Skipping idempotent check.');
      return null;
    }

    const scopePrefix = workspaceId ? `WS#${workspaceId}#` : '';

    const response = await docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: {
          userId: `${scopePrefix}IDEMPOTENCY#${idempotencyKey}`,
          timestamp: 0,
        },
      })
    );

    if (!response.Item) {
      return null;
    }

    const record = response.Item as IdempotencyRecord;

    // Check if the record has expired
    if (record.expiresAt && record.expiresAt < Math.floor(Date.now() / 1000)) {
      // Record has expired, treat as not found
      return null;
    }

    logger.info(`[IDEMPOTENCY] Found cached result for key: ${idempotencyKey}`);
    return record.result;
  } catch (error) {
    logger.error(`[IDEMPOTENCY] Error checking idempotency key: ${idempotencyKey}`, error);
    // On error, allow the operation to proceed (fail-open)
    return null;
  }
}

/**
 * Stores the result of an idempotent operation.
 *
 * @param idempotencyKey - The unique idempotency key for the operation.
 * @param result - The result to cache.
 * @param workspaceId - Optional workspace ID for multi-tenant isolation.
 */
export async function setIdempotentResult(
  idempotencyKey: string,
  result: unknown,
  workspaceId?: string
): Promise<void> {
  try {
    const tableName = getMemoryTableName();

    if (!tableName) {
      logger.info('[IDEMPOTENCY] MemoryTable not linked. Skipping idempotent save.');
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const scopePrefix = workspaceId ? `WS#${workspaceId}#` : '';

    const record: IdempotencyRecord = {
      idempotencyKey,
      result,
      createdAt: now,
      expiresAt: now + IDEMPOTENCY_TTL_SECONDS,
    };

    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          userId: `${scopePrefix}IDEMPOTENCY#${idempotencyKey}`,
          timestamp: 0,
          type: 'IDEMPOTENCY',
          workspaceId,
          ...record,
        },
        // Only set if the key doesn't exist (atomic check-and-set)
        ConditionExpression: 'attribute_not_exists(userId)',
      })
    );

    logger.info(`[IDEMPOTENCY] Cached result for key: ${idempotencyKey}`);
  } catch (error) {
    // If the key already exists, that's okay - another operation already cached the result
    if ((error as Error).name === 'ConditionalCheckFailedException') {
      logger.info(`[IDEMPOTENCY] Key already exists (concurrent operation): ${idempotencyKey}`);
      return;
    }

    logger.error(`[IDEMPOTENCY] Error storing idempotency key: ${idempotencyKey}`, error);
    // On error, allow the operation to proceed (fail-open)
  }
}

/**
 * Deletes an idempotency key (for cleanup or retry scenarios).
 *
 * @param idempotencyKey - The unique idempotency key to delete.
 * @param workspaceId - Optional workspace ID for multi-tenant isolation.
 */
export async function deleteIdempotentKey(
  idempotencyKey: string,
  workspaceId?: string
): Promise<void> {
  try {
    const tableName = getMemoryTableName();
    if (!tableName) return;

    const scopePrefix = workspaceId ? `WS#${workspaceId}#` : '';

    await docClient.send(
      new DeleteCommand({
        TableName: tableName,
        Key: {
          userId: `${scopePrefix}IDEMPOTENCY#${idempotencyKey}`,
          timestamp: 0,
        },
      })
    );

    logger.info(`[IDEMPOTENCY] Deleted key: ${idempotencyKey}`);
  } catch (error) {
    logger.error(`[IDEMPOTENCY] Error deleting idempotency key: ${idempotencyKey}`, error);
  }
}

/**
 * Wraps an async operation with idempotency protection.
 *
 * @param idempotencyKey - The unique idempotency key for the operation.
 * @param operation - The async operation to execute.
 * @param workspaceId - Optional workspace ID for multi-tenant isolation.
 * @returns The result of the operation (cached or fresh).
 */
export async function withIdempotency<T>(
  idempotencyKey: string,
  operation: () => Promise<T>,
  workspaceId?: string
): Promise<T> {
  // Check for cached result
  const cachedResult = await getIdempotentResult(idempotencyKey, workspaceId);
  if (cachedResult !== null) {
    logger.info(`[IDEMPOTENCY] Returning cached result for key: ${idempotencyKey}`);
    return cachedResult as T;
  }

  // Execute the operation
  const result = await operation();

  // Cache the result
  await setIdempotentResult(idempotencyKey, result, workspaceId);

  return result;
}
