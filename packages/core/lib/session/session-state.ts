import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { PendingMessage } from '../types/session';
import { logger } from '../logger';
import { TIME, RETENTION } from '../constants';
import { getMemoryTableName } from '../utils/ddb-client';
import { SessionLockHandler } from './lock-handler';
import { SessionMessageHandler } from './message-handler';
import { SessionSnapshotHandler } from './snapshot-handler';

const SESSION_PREFIX = 'SESSION_STATE#';
const SESSION_TTL_SECONDS = RETENTION.SESSION_METADATA_DAYS * 24 * 60 * 60;

const defaultClient = new DynamoDBClient({});
const defaultDocClient = DynamoDBDocumentClient.from(defaultClient, {
  marshallOptions: { removeUndefinedValues: true },
});

export interface SessionState {
  sessionId: string;
  processingAgentId: string | null;
  processingStartedAt: number | null;
  pendingMessages: PendingMessage[];
  lastMessageAt: number;
  workflowSnapshot?: {
    reason: string;
    timestamp: number;
    agentId: string;
    task: string;
    state: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  } | null;
  workspaceId?: string;
  teamId?: string;
  staffId?: string;
  userRole?: string;
}

/**
 * Orchestrates session state, locking, and pending message queues.
 * Decomposed into specialized handlers for maintainability and AI readiness.
 */
export class SessionStateManager {
  private docClient: DynamoDBDocumentClient;
  private lockHandler: SessionLockHandler;
  private messageHandler: SessionMessageHandler;
  private snapshotHandler: SessionSnapshotHandler;

  constructor(docClient?: DynamoDBDocumentClient) {
    this.docClient = docClient ?? defaultDocClient;
    this.lockHandler = new SessionLockHandler(this.docClient);
    this.messageHandler = new SessionMessageHandler(this.docClient);
    this.snapshotHandler = new SessionSnapshotHandler(this.docClient);
  }

  private getScopedKey(
    baseId: string,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): string {
    if (!scope || (!scope.workspaceId && !scope.teamId && !scope.staffId)) return baseId;
    const segments = ['WS'];
    if (scope.teamId) segments.push(`TEAM:${scope.teamId}`);
    if (scope.staffId) segments.push(`STAFF:${scope.staffId}`);
    if (scope.workspaceId) segments.push(scope.workspaceId);
    return `${segments.join('#')}#${baseId}`;
  }

  private get tableName(): string {
    return getMemoryTableName() ?? 'MemoryTable';
  }

  private getKey(
    sessionId: string,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): string {
    return this.getScopedKey(`${SESSION_PREFIX}${sessionId}`, scope);
  }

  private getSessionExpiresAt(): number {
    return Math.floor(Date.now() / TIME.MS_PER_SECOND) + SESSION_TTL_SECONDS;
  }

  // --- LOCKING OPERATIONS ---

  async acquireProcessing(
    sessionId: string,
    agentId: string,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): Promise<boolean> {
    return this.lockHandler.acquire(
      sessionId,
      agentId,
      this.tableName,
      this.getKey(sessionId, scope),
      this.getSessionExpiresAt(),
      scope
    );
  }

  async releaseProcessing(
    sessionId: string,
    agentId: string,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): Promise<void> {
    await this.lockHandler.release(sessionId, agentId, scope);

    const key = this.getKey(sessionId, scope);
    try {
      const result = await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { userId: key, timestamp: 0 },
          UpdateExpression:
            'SET processingAgentId = :null, processingStartedAt = :null, lockExpiresAt = :null, expiresAt = :exp',
          ConditionExpression: 'processingAgentId = :agentId',
          ExpressionAttributeValues: {
            ':null': null,
            ':agentId': agentId,
            ':exp': this.getSessionExpiresAt(),
          },
          ReturnValues: 'ALL_NEW',
        })
      );

      const attributes = result.Attributes;
      if (attributes && attributes.pendingMessages?.length > 0) {
        const nextMsg = attributes.pendingMessages[0];
        const content = nextMsg.content as string;
        const separatorIndex = content.indexOf(':');

        if (separatorIndex !== -1) {
          const targetAgentId = content.substring(0, separatorIndex).trim();
          const taskContent = content.substring(separatorIndex + 1).trim();
          const { emitEvent } = await import('../utils/bus');
          const idempotencyKey = `resume:${sessionId}:${nextMsg.id}`;

          await emitEvent(
            `${agentId}.session-release`,
            `dynamic_${targetAgentId}_task`,
            {
              userId: attributes.userId?.replace(SESSION_PREFIX, '') || 'unknown',
              task: taskContent,
              sessionId,
              traceId: `resume-${nextMsg.id}`,
              isContinuation: true,
              attachments: nextMsg.attachments,
              workspaceId: attributes.workspaceId,
              teamId: attributes.teamId,
              staffId: attributes.staffId,
            },
            { idempotencyKey }
          );

          await this.removePendingMessage(sessionId, nextMsg.id, scope);
        }
      }
    } catch (error: unknown) {
      if (!(error instanceof Error && error.name === 'ConditionalCheckFailedException')) {
        logger.error(`Session ${sessionId}: Failed to clear session metadata:`, error);
      }
    }
  }

  async renewProcessing(
    sessionId: string,
    agentId: string,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): Promise<boolean> {
    return this.lockHandler.renew(
      sessionId,
      agentId,
      this.tableName,
      this.getKey(sessionId, scope),
      this.getSessionExpiresAt(),
      scope
    );
  }

  async autoRenew(
    sessionId: string,
    agentId: string,
    options?: { force?: boolean; workspaceId?: string; teamId?: string; staffId?: string }
  ): Promise<void> {
    await this.lockHandler.autoRenew(
      sessionId,
      agentId,
      this.tableName,
      this.getKey(sessionId, options),
      this.getSessionExpiresAt(),
      options
    );
  }

  // --- MESSAGE OPERATIONS ---

  async addPendingMessage(
    sessionId: string,
    content: string,
    attachments?: PendingMessage['attachments'],
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): Promise<void> {
    return this.messageHandler.add(
      sessionId,
      content,
      this.tableName,
      this.getKey(sessionId, scope),
      this.getSessionExpiresAt(),
      attachments,
      scope
    );
  }

  async getPendingMessages(
    sessionId: string,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): Promise<PendingMessage[]> {
    return this.messageHandler.getAll(sessionId, this.tableName, this.getKey(sessionId, scope));
  }

  async removePendingMessage(
    sessionId: string,
    messageId: string,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): Promise<boolean> {
    return this.messageHandler.remove(
      sessionId,
      messageId,
      this.tableName,
      this.getKey(sessionId, scope),
      this.getSessionExpiresAt()
    );
  }

  async updatePendingMessage(
    sessionId: string,
    messageId: string,
    newContent: string,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): Promise<boolean> {
    return this.messageHandler.update(
      sessionId,
      messageId,
      newContent,
      this.tableName,
      this.getKey(sessionId, scope),
      this.getSessionExpiresAt()
    );
  }

  async clearPendingMessages(
    sessionId: string,
    messageIds?: string[],
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): Promise<void> {
    return this.messageHandler.clear(
      this.tableName,
      this.getKey(sessionId, scope),
      this.getSessionExpiresAt(),
      messageIds
    );
  }

  // --- SNAPSHOT OPERATIONS ---

  async saveSnapshot(
    sessionId: string,
    snapshot: NonNullable<SessionState['workflowSnapshot']>,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): Promise<void> {
    return this.snapshotHandler.save(
      sessionId,
      snapshot,
      this.tableName,
      this.getKey(sessionId, scope),
      this.getSessionExpiresAt()
    );
  }

  async clearSnapshot(
    sessionId: string,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): Promise<void> {
    return this.snapshotHandler.clear(sessionId, this.tableName, this.getKey(sessionId, scope));
  }

  // --- STATE RETRIEVAL ---

  async getState(
    sessionId: string,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): Promise<SessionState | null> {
    const key = this.getKey(sessionId, scope);
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { userId: key, timestamp: 0 },
          ConsistentRead: true,
        })
      );
      if (!result.Item) return null;

      return {
        sessionId: result.Item.sessionId,
        processingAgentId: result.Item.processingAgentId,
        processingStartedAt: result.Item.processingStartedAt,
        pendingMessages: (result.Item.pendingMessages as PendingMessage[]) ?? [],
        lastMessageAt: result.Item.lastMessageAt,
        workflowSnapshot: result.Item.workflowSnapshot,
        workspaceId: result.Item.workspaceId,
        teamId: result.Item.teamId,
        staffId: result.Item.staffId,
        userRole: result.Item.userRole,
      };
    } catch (error) {
      logger.error(`Session ${sessionId}: Failed to get session state:`, error);
      return null;
    }
  }
}
