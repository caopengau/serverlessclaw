import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../logger';
import type { SessionState } from './session-state';

/**
 * Handles workflow snapshots for session resumption.
 */
export class SessionSnapshotHandler {
  constructor(private docClient: DynamoDBDocumentClient) {}

  async save(
    sessionId: string,
    snapshot: NonNullable<SessionState['workflowSnapshot']>,
    tableName: string,
    key: string,
    expiresAt: number
  ): Promise<void> {
    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { userId: key, timestamp: 0 },
          UpdateExpression: 'SET workflowSnapshot = :snapshot, expiresAt = :exp',
          ConditionExpression: 'processingAgentId = :agentId',
          ExpressionAttributeValues: {
            ':snapshot': snapshot,
            ':exp': expiresAt,
            ':agentId': snapshot.agentId,
          },
        })
      );
      logger.info(`Session ${sessionId}: Workflow snapshot saved. Reason: ${snapshot.reason}`);
    } catch (error) {
      logger.error(`Session ${sessionId}: Failed to save workflow snapshot:`, error);
      throw error;
    }
  }

  async clear(sessionId: string, tableName: string, key: string): Promise<void> {
    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { userId: key, timestamp: 0 },
          UpdateExpression: 'SET workflowSnapshot = :null',
          ExpressionAttributeValues: {
            ':null': null,
          },
        })
      );
      logger.info(`Session ${sessionId}: Workflow snapshot cleared.`);
    } catch (error) {
      logger.error(`Session ${sessionId}: Failed to clear workflow snapshot:`, error);
    }
  }
}
