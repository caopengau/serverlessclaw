import { IMemory } from '../types/index';
import { DynamoMemoryCollaboration } from './dynamo/collaboration';

export { CachedMemory } from './cached-memory';

/**
 * Implementation of IMemory using AWS DynamoDB for persistent storage
 * with a tiered retention strategy.
 *
 * This class is now modularized into an inheritance chain in the ./dynamo directory
 * to comply with AI context budget and file length standards.
 *
 * Chain: BaseMemoryProvider -> DynamoMemoryBase -> DynamoMemoryGaps -> DynamoMemoryInsights -> DynamoMemorySessions -> DynamoMemoryCollaboration -> DynamoMemory
 */
export class DynamoMemory extends DynamoMemoryCollaboration implements IMemory {
  /**
   * Retrieves a single item by PK and SK.
   */
  async get(userId: string, timestamp: number | string) {
    const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
    const response = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { userId, timestamp },
      })
    );
    return response.Item;
  }

  /**
   * Puts a complete item into the memory table.
   */
  async put(item: Record<string, unknown>) {
    return this.putItem(item);
  }

  /**
   * Queries items by PK and SK prefix.
   */
  async query(userId: string, prefix: string) {
    return this.queryItems({
      KeyConditionExpression: 'userId = :userId AND begins_with(#ts, :prefix)',
      ExpressionAttributeNames: {
        '#ts': 'timestamp',
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':prefix': prefix,
      },
    });
  }

  /**
   * Deletes an item by PK and SK.
   */
  async delete(userId: string, timestamp: number | string) {
    return this.deleteItem({ userId, timestamp });
  }

  /**
   * Gets cache statistics for monitoring.
[... unchanged lines ...]

   * Implementation is currently a placeholder as DynamoMemory is stateless.
   */
  getCacheStats() {
    return {
      userData: { hits: 0, misses: 0, evictions: 0, size: 0 },
      conversation: { hits: 0, misses: 0, evictions: 0, size: 0 },
      global: { hits: 0, misses: 0, evictions: 0, size: 0 },
      search: { hits: 0, misses: 0, evictions: 0, size: 0 },
      overallHitRate: 0,
    };
  }
}
