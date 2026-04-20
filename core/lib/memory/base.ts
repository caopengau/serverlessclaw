import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';

import { Resource } from 'sst';
import { logger } from '../logger';
import { SSTResource } from '../types/system';

// Default client for backward compatibility - can be overridden via constructor for testing
const defaultClient = new DynamoDBClient({});
const defaultDocClient = DynamoDBDocumentClient.from(defaultClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});
const typedResource = Resource as unknown as SSTResource;

/**
 * Base logic for DynamoDB interactions within the memory system.
 * Focused on low-level CRUD operations and workspace scoping.
 * @since 2026-03-19
 */
export class BaseMemoryProvider {
  protected readonly docClient: DynamoDBDocumentClient;

  /**
   * Creates a new BaseMemoryProvider.
   * @param docClient - Optional DynamoDB Document Client for dependency injection (useful for testing)
   */
  constructor(docClient?: DynamoDBDocumentClient) {
    this.docClient = docClient ?? defaultDocClient;
  }

  /**
   * Public getter for the table name.
   */
  public getTableName(): string {
    return this.tableName;
  }

  /**
   * Public getter for the doc client.
   */
  public getDocClient(): DynamoDBDocumentClient {
    return this.docClient;
  }

  /**
   * Resolves table name lazily.
   *
   * @returns The resolved table name string.
   */
  protected get tableName(): string {
    return typedResource?.MemoryTable?.name ?? 'MemoryTable';
  }

  /**
   * Helper to derive a workspace-scoped userId for DynamoDB partition keys.
   * Format: WS#workspaceId#userId
   * If workspaceId is provided, prefixes the userId to ensure logical isolation.
   *
   * @param userId - The base user identifier.
   * @param workspaceId - Optional workspace identifier identifier.
   * @returns The scoped partition key string.
   */
  public getScopedUserId(userId: string, workspaceId?: string): string {
    if (!workspaceId) return userId;

    // Validation: userId should not contain workspace prefix characters to prevent spoofing
    if (userId.includes('WS#')) {
      logger.warn(`[SECURITY] Potential workspace prefix spoofing attempt in userId: ${userId}`);
      // Strip any existing WS#...# prefix to ensure target workspace takes precedence
      // Matches WS# followed by text up to the next #
      userId = userId.replace(/^WS#.*?#/g, '');
    }

    return `WS#${workspaceId}#${userId}`;
  }

  /**
   * Internal helper to put an item into DynamoDB.
   *
   * @param item - The item object to store.
   * @returns A promise resolving when the operation is complete.
   */
  public async putItem(
    item: Record<string, unknown>,
    params?: Partial<
      Pick<
        import('@aws-sdk/lib-dynamodb').PutCommandInput,
        'ConditionExpression' | 'ExpressionAttributeNames' | 'ExpressionAttributeValues'
      >
    >
  ): Promise<void> {
    const command = new PutCommand({
      TableName: this.tableName,
      Item: {
        ...item,
        attachments: (item.attachments as unknown[]) ?? [],
        tool_calls: (item.tool_calls as unknown[]) ?? [],
      },
      ...params,
    });
    try {
      await this.docClient.send(command);
    } catch (error) {
      logger.error('Error putting item into DynamoDB:', error);
      throw error;
    }
  }

  /**
   * Internal helper for Query commands.
   *
   * @param params - The DynamoDB QueryCommand parameters.
   * @returns A promise resolving to an object containing items and an optional LastEvaluatedKey.
   */
  public async queryItemsPaginated(params: Record<string, unknown>): Promise<{
    items: Record<string, unknown>[];
    lastEvaluatedKey?: Record<string, unknown>;
  }> {
    const command = new QueryCommand({
      TableName: this.tableName,
      ...params,
    });
    try {
      const response = await this.docClient.send(command);
      return {
        items: (response.Items as Record<string, unknown>[]) ?? [],
        lastEvaluatedKey: response.LastEvaluatedKey,
      };
    } catch (error) {
      logger.error('Error querying DynamoDB:', error);
      throw error;
    }
  }

  /**
   * Internal helper for Query commands (legacy non-paginated).
   *
   * @param params - The DynamoDB QueryCommand parameters.
   * @returns A promise resolving to an array of items.
   */
  public async queryItems(params: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    const { items } = await this.queryItemsPaginated(params);
    return items;
  }

  /**
   * Internal helper for Delete commands.
   *
   * @param params - The primary key of the item to delete, plus optional conditions.
   * @returns A promise resolving when the operation is complete.
   */
  public async deleteItem(
    params: {
      userId: string;
      timestamp: number | string;
    } & Partial<
      Pick<
        import('@aws-sdk/lib-dynamodb').DeleteCommandInput,
        'ConditionExpression' | 'ExpressionAttributeNames' | 'ExpressionAttributeValues'
      >
    >
  ): Promise<void> {
    const { userId, timestamp, ...conditions } = params;
    try {
      await this.docClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { userId, timestamp },
          ...conditions,
        })
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
        throw error;
      }
      logger.error('Error deleting item from DynamoDB:', error);
      throw error;
    }
  }

  /**
   * Internal helper for Update commands.
   *
   * @param params - The DynamoDB UpdateCommand parameters.
   * @returns A promise resolving to the update result.
   */
  public async updateItem(
    params: Record<string, unknown>
  ): Promise<import('@aws-sdk/lib-dynamodb').UpdateCommandOutput> {
    const command = new UpdateCommand({
      TableName: this.tableName,
      ...params,
    } as import('@aws-sdk/lib-dynamodb').UpdateCommandInput);
    return this.docClient.send(command);
  }

  /**
   * Internal helper for Scan commands with a prefix filter on the Hash Key (userId).
   * Note: This is an expensive Scan operation, used ONLY for system health sampling.
   * @internal
   */
  public async scanByPrefix(
    prefix: string,
    options?: { limit?: number }
  ): Promise<Record<string, unknown>[]> {
    const items: Record<string, unknown>[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined = undefined;
    const limit = options?.limit;

    try {
      do {
        const scanCommand = new ScanCommand({
          TableName: this.tableName,
          FilterExpression: 'begins_with(userId, :prefix)',
          ExpressionAttributeValues: {
            ':prefix': prefix,
          },
          ExclusiveStartKey: lastEvaluatedKey,
          Limit: limit,
        } as import('@aws-sdk/lib-dynamodb').ScanCommandInput);

        const scanResponse = (await this.docClient.send(
          scanCommand
        )) as import('@aws-sdk/lib-dynamodb').ScanCommandOutput;
        if (scanResponse.Items && scanResponse.Items.length > 0) {
          items.push(...(scanResponse.Items as Record<string, unknown>[]));
        }

        if (limit && items.length >= limit) break;
        lastEvaluatedKey = scanResponse.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      return items;
    } catch (error) {
      logger.error('Error scanning DynamoDB by prefix:', error);
      throw error;
    }
  }

  /**
   * Standard implementation for getHistory.
   * Filters out expired items based on TTL.
   */
  public async getHistory(userId: string, workspaceId?: string) {
    const { getHistory } = await import('./base-operations');
    return getHistory(this, userId, workspaceId);
  }

  /**
   * Standard implementation for clearHistory.
   */
  public async clearHistory(userId: string, workspaceId?: string) {
    const { clearHistory } = await import('./base-operations');
    return clearHistory(this, userId, workspaceId);
  }

  /**
   * Standard implementation for getDistilledMemory.
   */
  public async getDistilledMemory(userId: string, workspaceId?: string) {
    const { getDistilledMemory } = await import('./base-operations');
    return getDistilledMemory(this, userId, workspaceId);
  }

  /**
   * Standard implementation for listConversations.
   */
  public async listConversations(userId: string, workspaceId?: string) {
    const { listConversations } = await import('./base-operations');
    return listConversations(this, userId, workspaceId);
  }
}
