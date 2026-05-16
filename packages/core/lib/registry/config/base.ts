import { GetCommand, PutCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../../logger';
import { getConfigTableName } from '../../utils/ddb-client';
import { getDocClient } from './client';

/**
 * Base configuration management with caching and CRUD operations.
 */
export class ConfigManagerBase {
  protected static configCache = new Map<string, { value: unknown; expiresAt: number }>();
  protected static readonly CACHE_TTL_MS = 60000; // 1 minute (60s)

  /**
   * Clears the configuration cache. Primarily for testing.
   */
  public static clearCache(): void {
    this.configCache.clear();
  }

  /**
   * Internal helper to safely get the ConfigTable name.
   */
  protected static _getTableName(): string | undefined {
    return getConfigTableName();
  }

  /**
   * Resolves the effective key based on workspace or organization scoping.
   */
  protected static getEffectiveKey(
    key: string,
    options?: { workspaceId?: string; orgId?: string }
  ): string {
    if (options?.workspaceId) {
      return `WS#${options.workspaceId}#${key}`;
    }
    if (options?.orgId) {
      return `ORG#${options.orgId}#${key}`;
    }
    return key;
  }

  /**
   * Fetches a raw value from the ConfigTable by key.
   */
  public static async getRawConfig(
    key: string,
    options?: { workspaceId?: string; orgId?: string }
  ): Promise<unknown> {
    const tableName = this._getTableName();
    if (!tableName) {
      logger.warn(`ConfigTable not linked. Skipping fetch for ${key}`);
      return undefined;
    }

    const effectiveKey = this.getEffectiveKey(key, options);

    try {
      const response = await getDocClient().send(
        new GetCommand({
          TableName: tableName,
          Key: { key: effectiveKey },
        })
      );
      const Item = response?.Item;
      return Item?.value;
    } catch (e) {
      logger.warn(`Failed to fetch ${effectiveKey} from DDB:`, e);
      return undefined;
    }
  }

  /**
   * Fetches a configuration value with a type-safe fallback.
   * Implements internal caching to minimize DynamoDB overhead.
   * Scoped by workspace or org to ensure multi-tenant isolation (Principle 11).
   */
  public static async getTypedConfig<T>(
    key: string,
    defaultValue: T,
    options?: { workspaceId?: string; orgId?: string }
  ): Promise<T> {
    const cacheKey = this.getEffectiveKey(key, options);
    const cached = this.configCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }

    const value = await this.getRawConfig(key, options);
    const result = (value as T) ?? defaultValue;

    // Principle 11: Multi-tenant safety - prevent unbounded map growth (Anti-Pattern 19)
    if (this.configCache.size > 2000) {
      const oldestKey = this.configCache.keys().next().value;
      if (oldestKey) this.configCache.delete(oldestKey);
    }

    this.configCache.set(cacheKey, { value: result, expiresAt: Date.now() + this.CACHE_TTL_MS });
    return result;
  }

  /**
   * Saves a raw configuration value to the ConfigTable.
   */
  public static async saveRawConfig(
    key: string,
    value: unknown,
    options?: {
      author?: string;
      description?: string;
      skipVersioning?: boolean;
      workspaceId?: string;
      orgId?: string;
    }
  ): Promise<void> {
    const tableName = this._getTableName();
    if (!tableName) {
      logger.warn(`ConfigTable not linked. Skipping save for ${key}`);
      return;
    }

    const cacheKey = this.getEffectiveKey(key, options);
    this.configCache.delete(cacheKey);

    if (!options?.skipVersioning) {
      try {
        const oldValue = await this.getRawConfig(key, {
          workspaceId: options?.workspaceId,
          orgId: options?.orgId,
        });
        if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
          const { ConfigVersioning } = await import('../../config/config-versioning');
          await ConfigVersioning.snapshot(
            key,
            oldValue,
            value,
            options?.author ?? 'system',
            options?.description,
            { workspaceId: options?.workspaceId, orgId: options?.orgId }
          );
        }
      } catch (e) {
        logger.warn(`Failed to snapshot config version for ${key}:`, e);
      }
    }

    try {
      await getDocClient().send(
        new PutCommand({
          TableName: tableName,
          Item: { key: cacheKey, value },
        })
      );
    } catch (e) {
      logger.error(`Failed to save ${cacheKey} to DDB:`, e);
      throw e;
    }
  }

  /**
   * Deletes a configuration value from the ConfigTable.
   */
  public static async deleteConfig(
    key: string,
    options?: { workspaceId?: string; orgId?: string }
  ): Promise<void> {
    const tableName = this._getTableName();
    if (!tableName) {
      logger.warn(`ConfigTable not linked. Skipping delete for ${key}`);
      return;
    }

    const effectiveKey = this.getEffectiveKey(key, options);
    this.configCache.delete(effectiveKey);

    try {
      await getDocClient().send(
        new DeleteCommand({
          TableName: tableName,
          Key: { key: effectiveKey },
        })
      );
    } catch (e) {
      logger.error(`Failed to delete ${effectiveKey} from DDB:`, e);
      throw e;
    }
  }

  /**
   * Atomically updates a configuration value using a transform function.
   * Implements Read-Modify-Write with optimistic concurrency control.
   */
  public static async atomicUpdateValue<T>(
    key: string,
    transform: (current: T | undefined) => T | Promise<T>,
    options?: { workspaceId?: string; orgId?: string; maxRetries?: number }
  ): Promise<T> {
    const tableName = this._getTableName();
    if (!tableName) throw new Error('ConfigTable not linked');

    const effectiveKey = this.getEffectiveKey(key, options);
    const maxRetries = options?.maxRetries ?? 5;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        const response = await getDocClient().send(
          new GetCommand({
            TableName: tableName,
            Key: { key: effectiveKey },
            ConsistentRead: true,
          })
        );
        const Item = response?.Item;

        const current = Item?.value as T | undefined;
        const next = await transform(current);

        if (JSON.stringify(current) === JSON.stringify(next)) return next;

        await getDocClient().send(
          new UpdateCommand({
            TableName: tableName,
            Key: { key: effectiveKey },
            UpdateExpression: 'SET #val = :next, updatedAt = :now',
            ConditionExpression: Item ? '#val = :old' : 'attribute_not_exists(#val)',
            ExpressionAttributeNames: { '#val': 'value' },
            ExpressionAttributeValues: {
              ':next': next,
              ':old': current,
              ':now': Date.now(),
            },
          })
        );

        this.configCache.delete(effectiveKey);
        return next;
      } catch (e: unknown) {
        if (e instanceof Error && e.name === 'ConditionalCheckFailedException') {
          retryCount++;
          continue;
        }
        throw e;
      }
    }

    throw new Error(`Failed to atomically update ${effectiveKey} after ${maxRetries} retries`);
  }
}
