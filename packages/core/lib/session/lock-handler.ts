import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../logger';
import { LockManager } from '../lock/lock-manager';
import { TIME } from '../constants';

const LOCK_PREFIX = 'LOCK#SESSION#';
const LOCK_TTL_SECONDS = 300;

/**
 * Handles distributed locking for agent sessions to prevent concurrent processing.
 */
export class SessionLockHandler {
  private lockManager: LockManager;
  private lastRenewedAt: Map<string, number> = new Map();

  constructor(private docClient: DynamoDBDocumentClient) {
    this.lockManager = new LockManager(this.docClient);
  }

  async acquire(
    sessionId: string,
    agentId: string,
    tableName: string,
    key: string,
    expiresAt: number,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): Promise<boolean> {
    const lockId = `${LOCK_PREFIX}${sessionId}`;
    const nowSec = Math.floor(Date.now() / TIME.MS_PER_SECOND);
    const lockExpiresAt = nowSec + LOCK_TTL_SECONDS;

    const acquired = await this.lockManager.acquire(lockId, {
      ownerId: agentId,
      ttlSeconds: LOCK_TTL_SECONDS,
      prefix: '',
      workspaceId: scope?.workspaceId,
    });

    if (acquired) {
      this.lastRenewedAt.set(sessionId, Date.now());
      try {
        await this.docClient.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { userId: key, timestamp: 0 },
            UpdateExpression:
              'SET processingAgentId = :agentId, processingStartedAt = :now, lockExpiresAt = :lockExp, expiresAt = :exp, ' +
              'pendingMessages = if_not_exists(pendingMessages, :empty), ' +
              'workspaceId = :ws, teamId = :team, staffId = :staff',
            ExpressionAttributeValues: {
              ':agentId': agentId,
              ':now': Date.now(),
              ':lockExp': lockExpiresAt,
              ':exp': expiresAt,
              ':empty': [],
              ':ws': scope?.workspaceId ?? null,
              ':team': scope?.teamId ?? null,
              ':staff': scope?.staffId ?? null,
            },
          })
        );
      } catch (error) {
        logger.warn(`Session ${sessionId}: Lock acquired but state update failed.`, error);
      }
      return true;
    }
    return false;
  }

  async release(
    sessionId: string,
    agentId: string,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): Promise<void> {
    const lockId = `${LOCK_PREFIX}${sessionId}`;
    this.lastRenewedAt.delete(sessionId);
    await this.lockManager.release(lockId, agentId, {
      prefix: '',
      workspaceId: scope?.workspaceId,
    });
  }

  async renew(
    sessionId: string,
    agentId: string,
    tableName: string,
    key: string,
    expiresAt: number,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): Promise<boolean> {
    const lockId = `${LOCK_PREFIX}${sessionId}`;
    const nowSec = Math.floor(Date.now() / TIME.MS_PER_SECOND);
    const newLockExpiresAt = nowSec + LOCK_TTL_SECONDS;

    const renewed = await this.lockManager.renew(lockId, {
      ownerId: agentId,
      ttlSeconds: LOCK_TTL_SECONDS,
      prefix: '',
      workspaceId: scope?.workspaceId,
    });

    if (renewed) {
      this.lastRenewedAt.set(sessionId, Date.now());
      try {
        await this.docClient.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { userId: key, timestamp: 0 },
            UpdateExpression: 'SET lockExpiresAt = :lockExp, expiresAt = :exp',
            ConditionExpression: 'processingAgentId = :agentId',
            ExpressionAttributeValues: {
              ':lockExp': newLockExpiresAt,
              ':exp': expiresAt,
              ':agentId': agentId,
            },
          })
        );
      } catch (error) {
        logger.warn(`Session ${sessionId}: Lock renewed but state sync failed.`, error);
      }
    }
    return renewed;
  }

  async autoRenew(
    sessionId: string,
    agentId: string,
    tableName: string,
    key: string,
    expiresAt: number,
    options?: { force?: boolean; workspaceId?: string; teamId?: string; staffId?: string }
  ): Promise<void> {
    const lastRenewed = this.lastRenewedAt.get(sessionId);
    if (!lastRenewed && !options?.force) return;

    const now = Date.now();
    const thresholdMs = (LOCK_TTL_SECONDS * 1000) / 2;

    if (options?.force || now - (lastRenewed ?? 0) > thresholdMs) {
      await this.renew(sessionId, agentId, tableName, key, expiresAt, options);
    }
  }
}
