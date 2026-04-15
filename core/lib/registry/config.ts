import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { logger } from '../logger';

// Default client for backward compatibility - can be overridden for testing
const defaultClient = new DynamoDBClient({});
export const defaultDocClient = DynamoDBDocumentClient.from(defaultClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: true,
  },
});

// Allow tests to inject a custom docClient
let injectedDocClient: DynamoDBDocumentClient | undefined;

/**
 * Sets a custom docClient for testing purposes.
 * @param docClient - The DynamoDB Document Client to use
 */
export function setDocClient(docClient: DynamoDBDocumentClient): void {
  injectedDocClient = docClient;
}

function getDocClient(): DynamoDBDocumentClient {
  return injectedDocClient ?? defaultDocClient;
}

/**
 * Handles raw configuration storage and retrieval from DynamoDB.
 * @since 2026-03-19
 */
export class ConfigManager {
  /**
   * Fetches a raw value from the ConfigTable by key.
   *
   * @param key - The unique configuration key.
   * @returns A promise resolving to the configuration value or undefined.
   */
  public static async getRawConfig(key: string): Promise<unknown> {
    const resource = Resource as { ConfigTable?: { name: string } };
    if (!('ConfigTable' in resource)) {
      logger.warn(`ConfigTable not linked. Skipping fetch for ${key}`);
      return undefined;
    }

    try {
      const { Item } = await getDocClient().send(
        new GetCommand({
          TableName: resource.ConfigTable?.name,
          Key: { key },
        })
      );
      return Item?.value;
    } catch (e) {
      logger.warn(`Failed to fetch ${key} from DDB:`, e);
      return undefined;
    }
  }

  /**
   * Fetches a configuration value with a type-safe fallback.
   *
   * @param key - The unique configuration key.
   * @param defaultValue - The fallback value if the key is not found.
   * @returns A promise resolving to the typed configuration value.
   */
  public static async getTypedConfig<T>(key: string, defaultValue: T): Promise<T> {
    const value = await this.getRawConfig(key);
    return (value as T) ?? defaultValue;
  }

  /**
   * Fetches a configuration value with agent-specific override precedence.
   * Checks agent_config_<agentId>_<key> first, then falls back to global key.
   *
   * @param agentId - The agent identifier.
   * @param key - The configuration key.
   * @param fallback - The value to use if neither override nor global exists.
   * @returns A promise resolving to the effective configuration value.
   */
  public static async getAgentOverrideConfig<T>(
    agentId: string,
    key: string,
    fallback: T
  ): Promise<T> {
    const agentKey = `agent_config_${agentId}_${key}`;
    const agentValue = await this.getRawConfig(agentKey);
    if (agentValue !== undefined) return agentValue as T;
    return this.getTypedConfig<T>(key, fallback);
  }

  /**
   * Saves a raw configuration value to the ConfigTable.
   * Optionally snapshots the old value for versioning.
   *
   * @param key - The unique configuration key.
   * @param value - The value to store.
   * @param options - Optional versioning and audit options.
   */
  public static async saveRawConfig(
    key: string,
    value: unknown,
    options?: {
      author?: string;
      description?: string;
      skipVersioning?: boolean;
    }
  ): Promise<void> {
    const resource = Resource as { ConfigTable?: { name: string } };
    if (!('ConfigTable' in resource)) {
      logger.warn(`ConfigTable not linked. Skipping save for ${key}`);
      return;
    }

    if (!options?.skipVersioning) {
      try {
        const oldValue = await this.getRawConfig(key);
        if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
          const { ConfigVersioning } = await import('../config/config-versioning');
          await ConfigVersioning.snapshot(
            key,
            oldValue,
            value,
            options?.author ?? 'system',
            options?.description
          );
        }
      } catch (e) {
        logger.warn(`Failed to snapshot config version for ${key}:`, e);
      }
    }

    try {
      await getDocClient().send(
        new PutCommand({
          TableName: resource.ConfigTable?.name,
          Item: { key, value },
        })
      );
    } catch (e) {
      logger.error(`Failed to save ${key} to DDB:`, e);
      throw e;
    }
  }

  /**
   * Atomically appends a value to a list configuration.
   * Uses DynamoDB list_append to avoid lost update bugs.
   *
   * @param key - The unique configuration key.
   * @param item - The item to append.
   * @param options - Optional capping for the list (e.g., last 200 items).
   * @returns A promise that resolves when the append is complete.
   */
  public static async appendToList(
    key: string,
    item: unknown,
    options?: { limit?: number }
  ): Promise<void> {
    const resource = Resource as { ConfigTable?: { name: string } };
    if (!('ConfigTable' in resource)) {
      logger.warn(`ConfigTable not linked. Skipping append for ${key}`);
      return;
    }

    try {
      const { limit } = options || {};

      // Phase 1: Ensure value is initialized as a list if it doesn't exist
      await getDocClient().send(
        new UpdateCommand({
          TableName: resource.ConfigTable!.name,
          Key: { key },
          UpdateExpression: 'SET #val = if_not_exists(#val, :empty_list)',
          ExpressionAttributeNames: { '#val': 'value' },
          ExpressionAttributeValues: { ':empty_list': [] },
        })
      );

      // Phase 2: Append the item
      const result = await getDocClient().send(
        new UpdateCommand({
          TableName: resource.ConfigTable!.name,
          Key: { key },
          UpdateExpression: 'SET #val = list_append(#val, :items)',
          ExpressionAttributeNames: { '#val': 'value' },
          ExpressionAttributeValues: { ':items': [item] },
          ReturnValues: 'ALL_NEW',
        })
      );

      // Phase 3: Optional capping (best effort, not perfectly atomic with the append)
      // Since list_append + truncation can't be one atomic op in DDB without knowing length,
      // we do it if ReturnValues shows it's too long.
      const currentList = result.Attributes?.value as unknown[];
      if (limit && currentList && currentList.length > limit) {
        const excess = currentList.length - limit;
        // Truncate from the beginning
        await getDocClient()
          .send(
            new UpdateCommand({
              TableName: resource.ConfigTable!.name,
              Key: { key },
              UpdateExpression: `REMOVE ${Array.from({ length: excess }, (_, i) => `#val[${i}]`).join(', ')}`,
              ExpressionAttributeNames: { '#val': 'value' },
            })
          )
          .catch((e) => logger.debug(`List capping failed for ${key}:`, e));
      }
    } catch (e) {
      logger.error(`Failed to append to list ${key} in DDB:`, e);
      throw e;
    }
  }

  /**
   * Resolves the table name for the configured ConfigTable.
   *
   * @returns A promise resolving to the table name or undefined.
   */
  public static async resolveTableName(): Promise<string | undefined> {
    const resource = Resource as { ConfigTable?: { name: string } };
    return 'ConfigTable' in resource ? resource.ConfigTable!.name : undefined;
  }

  /**
   * Atomically increments a numeric configuration value.
   * Uses DynamoDB UpdateCommand with ADD operation to avoid lost update bugs.
   *
   * @param key - The unique configuration key.
   * @param increment - The amount to increment (default 1).
   * @returns A promise resolving to the new value after increment.
   */
  public static async incrementConfig(key: string, increment: number = 1): Promise<number> {
    const resource = Resource as { ConfigTable?: { name: string } };
    if (!('ConfigTable' in resource)) {
      logger.warn(`ConfigTable not linked. Skipping increment for ${key}`);
      return 0;
    }

    try {
      const result = await getDocClient().send(
        new UpdateCommand({
          TableName: resource.ConfigTable?.name,
          Key: { key },
          UpdateExpression: 'ADD #val :inc',
          ExpressionAttributeNames: { '#val': 'value' },
          ExpressionAttributeValues: { ':inc': increment },
          ReturnValues: 'ALL_NEW',
        })
      );
      return (result.Attributes?.value as number) ?? 0;
    } catch (e) {
      logger.warn(`Failed to increment ${key} in DDB:`, e);
      return 0;
    }
  }

  /**
   * Atomically updates a specific field for an entity within a map-based configuration.
   * Handles multi-level initialization of root and entity objects to prevent ValidationExceptions.
   * Scoped to Principle 13 (Atomic State Integrity).
   *
   * @param key - The unique configuration key (e.g., DYNAMO_KEYS.AGENTS_CONFIG).
   * @param entityId - The ID of the entity within the map (e.g., agentId).
   * @param field - The field name to update.
   * @param value - The new value to set.
   * @param retryCount - Internal retry counter for race conditions during initialization.
   */
  public static async atomicUpdateMapField(
    key: string,
    entityId: string,
    field: string,
    value: unknown,
    retryCount: number = 0
  ): Promise<void> {
    const resource = Resource as { ConfigTable?: { name: string } };
    if (!resource.ConfigTable?.name) return;

    const maxRetries = 3;
    const docClient = getDocClient();

    try {
      // Level 1: Standard update (Assumes root and entity exist)
      await docClient.send(
        new UpdateCommand({
          TableName: resource.ConfigTable.name,
          Key: { key },
          UpdateExpression: 'SET #val.#id.#field = :value',
          ConditionExpression: 'attribute_exists(#val.#id)',
          ExpressionAttributeNames: { '#val': 'value', '#id': entityId, '#field': field },
          ExpressionAttributeValues: { ':value': value },
        })
      );
    } catch (e: unknown) {
      if (!(e instanceof Error)) throw e;

      if (e.name === 'ValidationException' || e.name === 'ConditionalCheckFailedException') {
        try {
          // Level 2: Entity initialization (Assumes root exists)
          await docClient.send(
            new UpdateCommand({
              TableName: resource.ConfigTable.name,
              Key: { key },
              UpdateExpression: 'SET #val.#id = :entityObj',
              ConditionExpression: 'attribute_not_exists(#val.#id)',
              ExpressionAttributeNames: { '#val': 'value', '#id': entityId },
              ExpressionAttributeValues: { ':entityObj': { [field]: value } },
            })
          );
        } catch (innerE: unknown) {
          if (!(innerE instanceof Error)) throw innerE;

          if (innerErrorIsValidation(innerE)) {
            try {
              // Level 3: Root initialization
              await docClient.send(
                new UpdateCommand({
                  TableName: resource.ConfigTable.name,
                  Key: { key },
                  UpdateExpression: 'SET #val = :rootObj',
                  ConditionExpression: 'attribute_not_exists(#val)',
                  ExpressionAttributeNames: { '#val': 'value' },
                  ExpressionAttributeValues: { ':rootObj': { [entityId]: { [field]: value } } },
                })
              );
            } catch (rootE: unknown) {
              if (
                rootE instanceof Error &&
                rootE.name === 'ConditionalCheckFailedException' &&
                retryCount < maxRetries
              ) {
                return this.atomicUpdateMapField(key, entityId, field, value, retryCount + 1);
              }
              throw rootE;
            }
          } else if (innerE.name === 'ConditionalCheckFailedException' && retryCount < maxRetries) {
            return this.atomicUpdateMapField(key, entityId, field, value, retryCount + 1);
          } else {
            throw innerE;
          }
        }
      } else {
        throw e;
      }
    }
  }

  /**
   * Atomically updates a specific field for an entity with a conditional check on the current value.
   * This ensures the update only succeeds if the current value matches the expected value.
   */
  public static async atomicUpdateMapFieldWithCondition(
    key: string,
    entityId: string,
    field: string,
    value: unknown,
    expectedValue: unknown
  ): Promise<void> {
    const resource = Resource as { ConfigTable?: { name: string } };
    if (!resource.ConfigTable?.name) {
      logger.warn(`ConfigTable not linked. Skipping atomic update for ${key}/${entityId}`);
      return;
    }

    try {
      await getDocClient().send(
        new UpdateCommand({
          TableName: resource.ConfigTable.name,
          Key: { key },
          UpdateExpression: 'SET #val.#id.#field = :value',
          ConditionExpression: '#val.#id.#field = :expected',
          ExpressionAttributeNames: { '#val': 'value', '#id': entityId, '#field': field },
          ExpressionAttributeValues: { ':value': value, ':expected': expectedValue },
        })
      );
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'ConditionalCheckFailedException') {
        throw e;
      }
      logger.error(`Failed to atomically update ${key}/${entityId}.${field}:`, e);
      throw e;
    }
  }

  /**
   * Removes items from a list within a map entity atomically using conditional updates.
   * Since DynamoDB doesn't have a native "remove from list by value" in SET,
   * we use a read-modify-write pattern with a ConditionExpression on the specific list field.
   */
  public static async atomicRemoveFromMap(
    key: string,
    entityId: string,
    itemsToRemove: unknown[]
  ): Promise<void> {
    const resource = Resource as { ConfigTable?: { name: string } };
    if (!resource.ConfigTable?.name) return;

    let retryCount = 0;
    const maxRetries = 5;

    while (retryCount < maxRetries) {
      try {
        const { Item } = await getDocClient().send(
          new GetCommand({
            TableName: resource.ConfigTable.name,
            Key: { key },
            ProjectionExpression: '#val.#id',
            ExpressionAttributeNames: { '#val': 'value', '#id': entityId },
          })
        );

        const currentMap = Item?.value as Record<string, unknown[]>;
        const currentList = currentMap?.[entityId];
        if (!Array.isArray(currentList)) return;

        const newList = currentList.filter(
          (item) =>
            !itemsToRemove.some((toRemove) => JSON.stringify(item) === JSON.stringify(toRemove))
        );
        if (newList.length === currentList.length) return;

        await getDocClient().send(
          new UpdateCommand({
            TableName: resource.ConfigTable.name,
            Key: { key },
            UpdateExpression: 'SET #val.#id = :newList',
            ConditionExpression: '#val.#id = :oldList',
            ExpressionAttributeNames: { '#val': 'value', '#id': entityId },
            ExpressionAttributeValues: { ':newList': newList, ':oldList': currentList },
          })
        );
        return;
      } catch (e: unknown) {
        if (e instanceof Error && e.name === 'ConditionalCheckFailedException') {
          retryCount++;
          continue;
        }
        throw e;
      }
    }
  }

  public static async atomicRemoveFromMapList(
    key: string,
    entityId: string,
    field: string,
    itemsToRemove: unknown[]
  ): Promise<void> {
    const resource = Resource as { ConfigTable?: { name: string } };
    if (!resource.ConfigTable?.name) return;

    let retryCount = 0;
    const maxRetries = 5;

    while (retryCount < maxRetries) {
      try {
        // 1. Fetch current list
        const { Item } = await getDocClient().send(
          new GetCommand({
            TableName: resource.ConfigTable.name,
            Key: { key },
            ProjectionExpression: '#val.#id.#field',
            ExpressionAttributeNames: { '#val': 'value', '#id': entityId, '#field': field },
          })
        );

        const currentMap = Item?.value as Record<string, Record<string, unknown[]>>;
        const currentList = currentMap?.[entityId]?.[field];

        if (!Array.isArray(currentList)) return;

        // 2. Filter list
        const newList = currentList.filter(
          (item) =>
            !itemsToRemove.some((toRemove) => JSON.stringify(item) === JSON.stringify(toRemove))
        );
        if (newList.length === currentList.length) return; // Nothing to remove

        // 3. Conditional Update
        await getDocClient().send(
          new UpdateCommand({
            TableName: resource.ConfigTable.name,
            Key: { key },
            UpdateExpression: 'SET #val.#id.#field = :newList',
            ConditionExpression: '#val.#id.#field = :oldList',
            ExpressionAttributeNames: { '#val': 'value', '#id': entityId, '#field': field },
            ExpressionAttributeValues: { ':newList': newList, ':oldList': currentList },
          })
        );
        return; // Success
      } catch (e: unknown) {
        if (e instanceof Error && e.name === 'ConditionalCheckFailedException') {
          retryCount++;
          logger.debug(
            `[CONFIG] Race condition during atomic list removal for ${entityId}.${field}, retrying (${retryCount}/${maxRetries})...`
          );
          continue;
        }
        throw e;
      }
    }
    throw new Error(
      `Failed to atomically remove items from ${entityId}.${field} after ${maxRetries} retries.`
    );
  }

  /**
   * Atomically updates multiple fields for an entity using a partial object.
   *
   * @param key - The unique configuration key.
   * @param entityId - The ID of the entity.
   * @param updates - Object containing fields and their new values.
   */
  public static async atomicUpdateMapEntity(
    key: string,
    entityId: string,
    updates: Record<string, unknown>
  ): Promise<void> {
    const resource = Resource as { ConfigTable?: { name: string } };
    if (!resource.ConfigTable?.name) return;

    const docClient = getDocClient();
    const sets: string[] = [];
    const names: Record<string, string> = { '#val': 'value', '#id': entityId };
    const values: Record<string, unknown> = {};

    Object.entries(updates).forEach(([field, value], i) => {
      sets.push(`#val.#id.#f${i} = :v${i}`);
      names[`#f${i}`] = field;
      values[`:v${i}`] = value;
    });

    try {
      await docClient.send(
        new UpdateCommand({
          TableName: resource.ConfigTable.name,
          Key: { key },
          UpdateExpression: `SET ${sets.join(', ')}`,
          ConditionExpression: 'attribute_exists(#val.#id)',
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
        })
      );
    } catch (e: unknown) {
      const error = e as { name: string };
      if (
        error.name === 'ValidationException' ||
        error.name === 'ConditionalCheckFailedException'
      ) {
        // For complexity and safety, if initialization is needed, we do it field by field or full object
        // Fallback to a simpler set if entity doesn't exist
        await docClient.send(
          new UpdateCommand({
            TableName: resource.ConfigTable.name,
            Key: { key },
            UpdateExpression: 'SET #val.#id = :entity',
            ExpressionAttributeNames: { '#val': 'value', '#id': entityId },
          })
        );
      } else {
        throw e;
      }
    }
  }
}

function innerErrorIsValidation(e: Error): boolean {
  return e.name === 'ValidationException';
}
