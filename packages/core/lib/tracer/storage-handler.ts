import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../../logger';
import type { TraceStep } from '../types';

/**
 * Handles persistence logic for ClawTracer.
 */
export class TracerStorageHandler {
  constructor(
    private docClient: DynamoDBDocumentClient,
    private tableName: string
  ) {}

  async persistStep(traceId: string, nodeId: string, step: TraceStep): Promise<void> {
    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { traceId, nodeId },
          UpdateExpression:
            'SET steps = list_append(if_not_exists(steps, :empty), :step), updatedAt = :now',
          ExpressionAttributeValues: {
            ':step': [step],
            ':empty': [],
            ':now': Date.now(),
          },
        })
      );
    } catch (error) {
      logger.error(`[TRACER] Failed to persist step for ${traceId}:`, error);
    }
  }

  async updateStatus(
    traceId: string,
    nodeId: string,
    status: string,
    durationMs: number
  ): Promise<void> {
    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { traceId, nodeId },
          UpdateExpression: 'SET #s = :status, durationMs = :duration, updatedAt = :now',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: {
            ':status': status,
            ':duration': durationMs,
            ':now': Date.now(),
          },
        })
      );
    } catch (error) {
      logger.error(`[TRACER] Failed to update status for ${traceId}:`, error);
    }
  }

  async saveSummary(traceId: string, nodeId: string, summary: string): Promise<void> {
    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { traceId, nodeId },
          UpdateExpression: 'SET summary = :summary, updatedAt = :now',
          ExpressionAttributeValues: {
            ':summary': summary,
            ':now': Date.now(),
          },
        })
      );
    } catch (error) {
      logger.error(`[TRACER] Failed to save summary for ${traceId}:`, error);
    }
  }
}
