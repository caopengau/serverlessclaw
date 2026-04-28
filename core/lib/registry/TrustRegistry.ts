import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../logger';
import { ConfigManager, getDocClient } from './config';
import { getConfigTableName } from '../utils/ddb-client';
import { DYNAMO_KEYS } from '../constants';

/**
 * Handles agent trust score management and monotonic progress.
 */
export class TrustRegistry {
  /**
   * Atomically increments the trust score for an agent.
   */
  static async atomicIncrementTrustScore(
    agentId: string,
    delta: number,
    options: { workspaceId?: string; min?: number; max?: number } = {}
  ): Promise<number> {
    return ConfigManager.atomicIncrementMapField(
      DYNAMO_KEYS.AGENTS_CONFIG,
      agentId,
      'trustScore',
      delta,
      options
    );
  }

  /**
   * Atomically sets the trust score for an agent, conditional on the current score.
   */
  static async atomicSetAgentTrustScore(
    agentId: string,
    expectedOldScore: number,
    newScore: number,
    options?: { workspaceId?: string }
  ): Promise<boolean> {
    const tableName = getConfigTableName();
    if (!tableName) throw new Error('ConfigTable not linked.');

    const effectiveKey = options?.workspaceId
      ? `WS#${options.workspaceId}#${DYNAMO_KEYS.AGENTS_CONFIG}`
      : DYNAMO_KEYS.AGENTS_CONFIG;

    let conditionExpression = '#agents.#id.trustScore = :expectedOldScore';
    if (expectedOldScore === 100) {
      conditionExpression =
        '(attribute_not_exists(#agents.#id.trustScore) OR #agents.#id.trustScore = :expectedOldScore)';
    }

    try {
      await getDocClient().send(
        new UpdateCommand({
          TableName: tableName,
          Key: { key: effectiveKey },
          UpdateExpression: 'SET #agents.#id.trustScore = :newScore',
          ConditionExpression: conditionExpression,
          ExpressionAttributeNames: { '#agents': 'value', '#id': agentId },
          ExpressionAttributeValues: {
            ':newScore': newScore,
            ':expectedOldScore': expectedOldScore,
          },
        })
      );
      return true;
    } catch (e: unknown) {
      const err = e as { name?: string };
      if (err.name === 'ConditionalCheckFailedException' || err.name === 'ValidationException') {
        throw e;
      }
      logger.error(`[TrustRegistry] Failed to conditionally set trustScore for ${agentId}:`, e);
      throw e;
    }
  }
}
