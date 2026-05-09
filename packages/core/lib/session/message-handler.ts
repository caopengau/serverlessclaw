import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../logger';

import { generateMessageId } from '../utils/id-generator';
import type { PendingMessage } from '../types/session';

/**
 * Handles pending messages in a session.
 */
export class SessionMessageHandler {
  constructor(private docClient: DynamoDBDocumentClient) {}

  async add(
    sessionId: string,
    content: string,
    tableName: string,
    key: string,
    expiresAt: number,
    attachments?: PendingMessage['attachments'],
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): Promise<void> {
    const now = Date.now();
    const messageId = generateMessageId('pending');

    const pendingMessage: PendingMessage = {
      id: messageId,
      content,
      attachments,
      timestamp: now,
    };

    const MAX_PENDING = 50;

    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { userId: key, timestamp: 0 },
          UpdateExpression:
            'SET pendingMessages = list_append(if_not_exists(pendingMessages, :empty), :msg), lastMessageAt = :now, expiresAt = :exp, workspaceId = :ws, teamId = :team, staffId = :staff',
          ConditionExpression:
            'attribute_not_exists(pendingMessages) OR size(pendingMessages) < :max',
          ExpressionAttributeValues: {
            ':empty': [],
            ':msg': [pendingMessage],
            ':now': now,
            ':exp': expiresAt,
            ':max': MAX_PENDING,
            ':ws': scope?.workspaceId ?? null,
            ':team': scope?.teamId ?? null,
            ':staff': scope?.staffId ?? null,
          },
        })
      );
      logger.info(`Session ${sessionId}: Added pending message ${messageId}`);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
        logger.warn(
          `Session ${sessionId}: Pending message queue full (${MAX_PENDING}), rejecting new message`
        );
        throw new Error(
          `PENDING_QUEUE_FULL: Session ${sessionId} has ${MAX_PENDING} pending messages`
        );
      }
      logger.error(`Session ${sessionId}: Failed to add pending message:`, error);
      throw error;
    }
  }

  async getAll(sessionId: string, tableName: string, key: string): Promise<PendingMessage[]> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: tableName,
          Key: { userId: key, timestamp: 0 },
          ConsistentRead: true,
        })
      );
      return (result.Item?.pendingMessages as PendingMessage[]) ?? [];
    } catch (error) {
      logger.error(`Session ${sessionId}: Failed to get pending messages:`, error);
      return [];
    }
  }

  async remove(
    sessionId: string,
    messageId: string,
    tableName: string,
    key: string,
    expiresAt: number
  ): Promise<boolean> {
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const messages = await this.getAll(sessionId, tableName, key);
        const filtered = messages.filter((m) => m.id !== messageId);
        if (filtered.length === messages.length) return false;

        await this.docClient.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { userId: key, timestamp: 0 },
            UpdateExpression:
              'SET pendingMessages = :filtered, expiresAt = :exp, #lastUpdate = :now',
            ConditionExpression: 'pendingMessages = :old',
            ExpressionAttributeNames: { '#lastUpdate': 'lastPendingMessageClear' },
            ExpressionAttributeValues: {
              ':filtered': filtered,
              ':old': messages,
              ':exp': expiresAt,
              ':now': Date.now(),
            },
          })
        );
        return true;
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
          if (attempt === MAX_ATTEMPTS) return false;
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 50));
        } else {
          throw error;
        }
      }
    }
    return false;
  }

  async update(
    sessionId: string,
    messageId: string,
    newContent: string,
    tableName: string,
    key: string,
    expiresAt: number
  ): Promise<boolean> {
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const messages = await this.getAll(sessionId, tableName, key);
        const updated = messages.map((m) =>
          m.id === messageId ? { ...m, content: newContent, timestamp: Date.now() } : m
        );
        if (JSON.stringify(messages) === JSON.stringify(updated)) return false;

        await this.docClient.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { userId: key, timestamp: 0 },
            UpdateExpression:
              'SET pendingMessages = :updated, expiresAt = :exp, #lastUpdate = :now',
            ConditionExpression: 'pendingMessages = :old',
            ExpressionAttributeNames: { '#lastUpdate': 'lastPendingMessageClear' },
            ExpressionAttributeValues: {
              ':updated': updated,
              ':old': messages,
              ':exp': expiresAt,
              ':now': Date.now(),
            },
          })
        );
        return true;
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
          if (attempt === MAX_ATTEMPTS) return false;
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 50));
        } else {
          throw error;
        }
      }
    }
    return false;
  }

  async clear(
    tableName: string,
    key: string,
    expiresAt: number,
    messageIds?: string[]
  ): Promise<void> {
    if (messageIds && messageIds.length > 0) {
      for (const id of messageIds) {
        await this.remove(undefined as any, id, tableName, key, expiresAt);
      }
      return;
    }
    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { userId: key, timestamp: 0 },
          UpdateExpression: 'SET pendingMessages = :empty, expiresAt = :exp',
          ExpressionAttributeValues: {
            ':empty': [],
            ':exp': expiresAt,
          },
        })
      );
    } catch (error) {
      logger.error(`Failed to clear pending messages for key ${key}:`, error);
    }
  }
}
