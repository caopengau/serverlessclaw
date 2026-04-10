/**
 * Idempotency Checker for Event Processing
 * Prevents duplicate processing of events during retry storms
 */

import { logger } from '../../lib/logger';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const IDEMPOTENCY_TTL_SECONDS = 300; // 5 minutes - aligns with typical retry windows
const IDEMPOTENCY_KEY_PREFIX = 'IDEMPOTENCY#';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

/**
 * Check if an event has already been processed recently
 * @param envelopeId - The EventBridge envelope ID
 * @param eventType - The event type
 * @returns true if already processed
 */
export async function checkIdempotency(envelopeId: string, eventType: string): Promise<boolean> {
  try {
    const key = `${IDEMPOTENCY_KEY_PREFIX}${envelopeId}`;
    const result = await docClient.send(
      new GetCommand({
        TableName: process.env.MEMORY_TABLE_NAME ?? 'MemoryTable',
        Key: { userId: key, timestamp: '0' },
      })
    );

    if (result.Item) {
      logger.info(`[IDEMPOTENCY] Duplicate detected: ${envelopeId} (${eventType})`);
      return true;
    }

    return false;
  } catch (error) {
    // If check fails, allow processing (fail-open)
    logger.warn(`[IDEMPOTENCY] Check failed for ${envelopeId}, allowing processing:`, error);
    return false;
  }
}

/**
 * Mark an event as processed for idempotency tracking
 * @param envelopeId - The EventBridge envelope ID
 * @param eventType - The event type
 */
export async function markIdempotent(envelopeId: string, eventType: string): Promise<void> {
  try {
    const key = `${IDEMPOTENCY_KEY_PREFIX}${envelopeId}`;
    const expiresAt = Math.floor(Date.now() / 1000) + IDEMPOTENCY_TTL_SECONDS;

    await docClient.send(
      new PutCommand({
        TableName: process.env.MEMORY_TABLE_NAME ?? 'MemoryTable',
        Item: {
          userId: key,
          timestamp: '0',
          type: 'IDEMPOTENCY',
          eventType,
          processedAt: Date.now(),
          expiresAt,
        },
      })
    );

    logger.info(`[IDEMPOTENCY] Marked ${envelopeId} as processed (${eventType})`);
  } catch (error) {
    // Don't fail the main operation if marking fails
    logger.warn(`[IDEMPOTENCY] Failed to mark ${envelopeId} as processed:`, error);
  }
}
