import { BaseMemoryProvider } from '../base';
import { logger } from '../../logger';

/**
 * Base implementation for DynamoMemory providing core utility methods.
 */
export class DynamoMemoryBase extends BaseMemoryProvider {
  /**
   * Retrieves a configuration JSON from the memory table.
   * Supports optional workspace scoping.
   *
   * @param key - The configuration key.
   * @param scope - Optional workspace scoping.
   */
  async getConfig(
    key: string,
    scope?: string | import('../../types/memory').ContextualScope
  ): Promise<Record<string, unknown> | undefined> {
    const scopedKey = this.getScopedUserId(key, scope);
    logger.debug(`[DynamoMemory] getConfig: ${scopedKey}`);

    const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
    const response = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { userId: scopedKey, timestamp: 0 },
      })
    );
    return response.Item as Record<string, unknown> | undefined;
  }
}
