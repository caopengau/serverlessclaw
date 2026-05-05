import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { TraceSource } from '../types/agent';
import { v4 as uuidv4 } from 'uuid';
import { TRACE_STATUS, TIME } from '../constants';
import { logger } from '../logger';
import { filterPIIFromObject } from '../utils/pii';
import { getDocClient, getTraceTableName } from '../utils/ddb-client';
import type { TraceStep, Trace } from './types';
import { TracerStorageHandler } from './storage-handler';

/**
 * ClawTracer provides observability into an agent's internal reasoning process.
 */
export class ClawTracer {
  private traceId: string;
  private nodeId: string;
  private parentId?: string;
  private userId: string;
  private workspaceId?: string;
  private orgId?: string;
  private teamId?: string;
  private staffId?: string;
  private source: TraceSource | string;
  private agentId?: string;
  private startTime: number;
  private readonly docClient: DynamoDBDocumentClient;
  private storage: TracerStorageHandler;

  constructor(
    userId: string,
    source: TraceSource | string = TraceSource.SYSTEM,
    traceId?: string,
    nodeId?: string,
    parentId?: string,
    agentId?: string,
    scope?: { workspaceId?: string; orgId?: string; teamId?: string; staffId?: string },
    docClient?: DynamoDBDocumentClient
  ) {
    this.userId = userId;
    this.source = source;
    this.traceId = traceId ?? uuidv4();
    this.nodeId = nodeId ?? uuidv4();
    this.parentId = parentId;
    this.agentId = agentId;
    this.startTime = Date.now();
    this.docClient = docClient ?? getDocClient();
    this.workspaceId = scope?.workspaceId;
    this.orgId = scope?.orgId;
    this.teamId = scope?.teamId;
    this.staffId = scope?.staffId;
    this.storage = new TracerStorageHandler(this.docClient, getTraceTableName() ?? 'TraceTable');
  }

  getTraceId(): string {
    return this.traceId;
  }
  getNodeId(): string {
    return this.nodeId;
  }

  async start(): Promise<void> {
    const trace: Trace = {
      traceId: this.traceId,
      nodeId: this.nodeId,
      parentId: this.parentId,
      userId: this.userId,
      workspaceId: this.workspaceId,
      orgId: this.orgId,
      teamId: this.teamId,
      staffId: this.staffId,
      agentId: this.agentId,
      source: this.source,
      status: TRACE_STATUS.STARTED,
      timestamp: this.startTime,
      steps: [],
      updatedAt: this.startTime,
      expiresAt: Math.floor(this.startTime / 1000) + TIME.SECONDS_IN_DAY * 30,
    };

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: getTraceTableName() ?? 'TraceTable',
          Item: trace,
        })
      );
    } catch (error) {
      logger.error(`[TRACER] Failed to start trace ${this.traceId}:`, error);
    }
  }

  async recordStep(
    type: string,
    content: any,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    const step: TraceStep = {
      stepId: uuidv4(),
      timestamp: Date.now(),
      type,
      content: filterPIIFromObject(content),
      metadata,
    };

    await this.storage.persistStep(this.traceId, this.nodeId, step);
  }

  async complete(): Promise<void> {
    const durationMs = Date.now() - this.startTime;
    await this.storage.updateStatus(this.traceId, this.nodeId, TRACE_STATUS.COMPLETED, durationMs);
  }

  async fail(error: unknown): Promise<void> {
    const durationMs = Date.now() - this.startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    await this.recordStep('error', { errorMessage });
    await this.storage.updateStatus(this.traceId, this.nodeId, TRACE_STATUS.FAILED, durationMs);
  }

  async saveSummary(summary: string): Promise<void> {
    await this.storage.saveSummary(this.traceId, this.nodeId, summary);
  }
}
