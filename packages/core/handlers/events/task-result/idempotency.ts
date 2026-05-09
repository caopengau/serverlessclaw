/**
 * Idempotency logic for task result processing.
 * Uses DynamoDB to ensure cross-invocation at-least-once delivery protection.
 */

export async function checkAndMarkProcessed(
  eventId: string,
  workspaceId?: string
): Promise<boolean> {
  try {
    const [{ DynamoDBClient }, { DynamoDBDocumentClient, PutCommand }, { Resource }] =
      await Promise.all([
        import('@aws-sdk/client-dynamodb'),
        import('@aws-sdk/lib-dynamodb'),
        import('sst'),
      ]);

    const tableName = (Resource as unknown as { MemoryTable: { name: string } }).MemoryTable.name;
    const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour TTL
    const scopePrefix = workspaceId ? `WS#${workspaceId}#` : '';

    await db.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          userId: `${scopePrefix}IDEMPOTENCY#task_result:${eventId}`,
          timestamp: Date.now(),
          type: 'IDEMPOTENCY',
          expiresAt,
          workspaceId,
        },
        ConditionExpression: 'attribute_not_exists(userId)',
      })
    );
    return true; // Successfully marked — this is the first processing
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
      return false; // Already processed
    }
    // If DynamoDB fails, allow processing (fail-open)
    const { logger } = await import('../../../lib/logger');
    logger.warn('Idempotency check failed, proceeding:', error);
    return true;
  }
}
