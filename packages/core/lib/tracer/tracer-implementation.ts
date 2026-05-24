import {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  type UpdateCommandInput,
  type PutCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { TraceSource } from '../types/agent';
import { v4 as uuidv4 } from 'uuid';
import { TRACE_STATUS, TIME, TRACE_TYPES } from '../constants';
import { logger } from '../logger';
import { filterPIIFromObject } from '../utils/pii';
import { getDocClient, getTraceTableName } from '../utils/ddb-client';
import { FlowController } from '../routing/flow-controller';
import type { TraceStep, Trace } from './types';
import { METRICS } from '../metrics/metrics';

// Removed local doc client management in favor of shared utility

/**
 * ClawTracer provides observability into an agent's internal reasoning process
 * by persisting steps and metadata to DynamoDB.
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
  private summariesEnabled: boolean | null = null;

  /**
   * Initializes a new ClawTracer instance.
   *
   * @param userId - Unique identifier for the user or session.
   * @param source - Origin of the request.
   * @param traceId - Unique ID for the entire conversation/workflow.
   * @param nodeId - Unique ID for this specific agent execution or branch.
   * @param parentId - Optional ID of the node that spawned this one.
   * @param agentId - Optional ID of the agent executing this trace.
   * @param scope - Optional hierarchical scope for isolation.
   * @param docClient - Optional DynamoDB Document Client for dependency injection.
   */
  constructor(
    userId: string,
    source: TraceSource | string = TraceSource.UNKNOWN,
    traceId?: string,
    nodeId?: string,
    parentId?: string,
    agentId?: string,
    scope?: {
      workspaceId?: string;
      orgId?: string;
      teamId?: string;
      staffId?: string;
    },
    docClient?: DynamoDBDocumentClient
  ) {
    this.userId = userId;
    this.source = source;
    this.traceId = traceId ?? uuidv4();
    this.nodeId = nodeId ?? 'root';
    this.parentId = parentId;
    this.agentId = agentId;
    this.workspaceId = scope?.workspaceId;
    this.orgId = scope?.orgId;
    this.teamId = scope?.teamId;
    this.staffId = scope?.staffId;
    this.startTime = Date.now();
    this.docClient = docClient ?? getDocClient();
  }

  private getTableName(): string {
    return getTraceTableName() ?? 'TraceTable';
  }

  /**
   * lazy-load and cache summary enablement status to ensure consistency during the trace lifecycle.
   */
  private async isSummaryEnabled(): Promise<boolean> {
    if (this.summariesEnabled === null) {
      this.summariesEnabled =
        (await FlowController.areTraceSummariesEnabled(this.workspaceId)) && this.nodeId === 'root';
    }
    return this.summariesEnabled;
  }

  /**
   * Internal helper to update or create the trace summary item.
   */
  private async updateSummary(
    status: string,
    options: { extra?: Record<string, unknown>; isNew?: boolean } = {}
  ): Promise<void> {
    const { extra = {}, isNew = false } = options;
    if (!(await this.isSummaryEnabled())) return;

    await this.bestEffort(async () => {
      if (isNew) {
        const item: Record<string, unknown> = {
          traceId: this.traceId,
          nodeId: '__summary__',
          userId: this.userId,
          source: this.source,
          agentId: this.agentId,
          timestamp: this.startTime,
          status,
          workspaceId: this.workspaceId,
          orgId: this.orgId,
          teamId: this.teamId,
          staffId: this.staffId,
          totalTokens: extra.totalTokens ?? 0,
          ...extra,
        };

        const toolNamesArray = extra.toolNames as string[] | undefined;
        if (toolNamesArray && toolNamesArray.length > 0) {
          item.toolNames = new Set(toolNamesArray);
        }

        await this.docClient.send(
          new PutCommand({
            TableName: this.getTableName(),
            Item: item,
            ConditionExpression: 'attribute_not_exists(traceId)',
          } as PutCommandInput)
        );
      } else {
        const setActions = ['#status = :status', '#ts = :ts'];
        const addActions: string[] = [];
        const attrNames: Record<string, string> = { '#status': 'status', '#ts': 'timestamp' };
        const attrValues: Record<string, unknown> = { ':status': status, ':ts': Date.now() };

        Object.entries(extra).forEach(([key, val], i) => {
          if (key === 'totalTokens' && typeof val === 'number' && val > 0) {
            addActions.push('#tokens :tokens');
            attrNames['#tokens'] = 'totalTokens';
            attrValues[':tokens'] = val;
          } else if (key === 'toolNames' && Array.isArray(val) && val.length > 0) {
            addActions.push('#tools :tools');
            attrNames['#tools'] = 'toolNames';
            attrValues[':tools'] = new Set(val);
          } else if (key !== 'totalTokens' && key !== 'toolNames') {
            const valKey = `:v${i}`;
            setActions.push(`#k${i} = ${valKey}`);
            attrNames[`#k${i}`] = key;
            attrValues[valKey] = val;
          }
        });

        let updateExpression = `SET ${setActions.join(', ')}`;
        if (addActions.length > 0) {
          updateExpression += ` ADD ${addActions.join(', ')}`;
        }

        const updateParams: UpdateCommandInput = {
          TableName: this.getTableName(),
          Key: { traceId: this.traceId, nodeId: '__summary__' },
          UpdateExpression: updateExpression,
          ConditionExpression: this.workspaceId
            ? 'attribute_exists(traceId) AND workspaceId = :wsId'
            : 'attribute_exists(traceId)',
          ExpressionAttributeNames: attrNames,
          ExpressionAttributeValues: attrValues,
        };

        if (this.workspaceId) {
          const values = updateParams.ExpressionAttributeValues as Record<string, unknown>;
          values[':wsId'] = this.workspaceId;
        }

        await this.docClient.send(new UpdateCommand(updateParams));
      }
    }, 'UpdateSummary');
  }

  /**
   * Initializes a new trace node in DynamoDB.
   *
   * @param initialContext - Initial context for the trace (e.g., user input).
   * @returns A promise that resolves to the trace ID.
   */
  async startTrace(initialContext: Record<string, unknown>): Promise<string> {
    const { AgentRegistry } = await import('../registry');
    const days = await AgentRegistry.getRetentionDays('TRACES_DAYS');
    const now = Date.now();
    const expiresAt = Math.floor(now / TIME.MS_PER_SECOND) + days * TIME.SECONDS_IN_DAY;

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.getTableName(),
          Item: {
            traceId: this.traceId,
            nodeId: this.nodeId,
            parentId: this.parentId,
            userId: this.userId,
            source: this.source,
            agentId: this.agentId,
            workspaceId: this.workspaceId,
            orgId: this.orgId,
            teamId: this.teamId,
            staffId: this.staffId,
            timestamp: now,
            status: TRACE_STATUS.STARTED,
            initialContext,
            steps: [],
            expiresAt,
          },
          ConditionExpression: 'attribute_not_exists(traceId) AND attribute_not_exists(nodeId)',
        } as PutCommandInput)
      );

      await this.updateSummary(TRACE_STATUS.STARTED, {
        extra: {
          title: initialContext?.title ?? initialContext?.message ?? null,
          expiresAt,
        },
        isNew: true,
      });
    } catch (e: unknown) {
      if (
        e &&
        typeof e === 'object' &&
        'name' in e &&
        (e as { name: string }).name === 'ConditionalCheckFailedException'
      ) {
        logger.info(`Trace node ${this.traceId}/${this.nodeId} already exists, skipping.`);
      } else {
        throw e;
      }
    }
    return this.traceId;
  }

  /**
   * Spawns a new child tracer for parallel or delegated execution.
   *
   * @param newNodeId - Optional ID for the new node.
   * @param childAgentId - Optional ID for the agent executing the child trace.
   * @returns A new ClawTracer instance correctly linked to this parent.
   */
  getChildTracer(newNodeId?: string, childAgentId?: string): ClawTracer {
    return new ClawTracer(
      this.userId,
      this.source,
      this.traceId,
      newNodeId ?? uuidv4(),
      this.nodeId,
      childAgentId ?? this.agentId,
      {
        workspaceId: this.workspaceId,
        orgId: this.orgId,
        teamId: this.teamId,
        staffId: this.staffId,
      },
      this.docClient
    );
  }

  /**
   * Adds a step to the current trace node.
   *
   * @param step - The step content and type.
   * @returns A promise that resolves when the step is added.
   */
  async addStep(step: Omit<TraceStep, 'stepId' | 'timestamp'>): Promise<void> {
    const fullStep: TraceStep = filterPIIFromObject({
      ...step,
      stepId: uuidv4(),
      timestamp: Date.now(),
    }) as TraceStep;

    const updateParams: UpdateCommandInput = {
      TableName: this.getTableName(),
      Key: { traceId: this.traceId, nodeId: this.nodeId },
      UpdateExpression: 'SET #steps = list_append(if_not_exists(#steps, :empty_list), :step)',
      ConditionExpression: this.workspaceId
        ? 'attribute_exists(traceId) AND workspaceId = :wsId'
        : 'attribute_exists(traceId)',
      ExpressionAttributeNames: { '#steps': 'steps' },
      ExpressionAttributeValues: {
        ':step': [fullStep],
        ':empty_list': [],
      },
    };

    if (this.workspaceId) {
      const values = updateParams.ExpressionAttributeValues as Record<string, unknown>;
      values[':wsId'] = this.workspaceId;
    }

    await this.docClient.send(new UpdateCommand(updateParams));

    const extra: Record<string, unknown> = { lastStepType: step.type };

    // Sh5: Accumulate metrics for the summary view to avoid N+1 queries in the dashboard
    if (step.type === TRACE_TYPES.LLM_RESPONSE) {
      const content = step.content as {
        usage?: { total_tokens?: number; totalInputTokens?: number; totalOutputTokens?: number };
      };
      if (content?.usage) {
        extra.totalTokens =
          content.usage.total_tokens ||
          (content.usage.totalInputTokens ?? 0) + (content.usage.totalOutputTokens ?? 0);
      }
    } else if (step.type === TRACE_TYPES.TOOL_CALL) {
      const content = step.content as { toolName?: string; tool?: string };
      const toolName = content?.toolName || content?.tool;
      if (toolName) {
        extra.toolNames = [toolName];
      }
    }

    await this.updateSummary(TRACE_STATUS.STARTED, {
      extra,
    });
  }

  /**
   * Adds multiple steps to the current trace node in a single atomic update.
   * Sh5/Parallelism: Prevents write contention and improves throughput for batch tool execution.
   *
   * @param steps - Array of step contents and types.
   */
  async batchAddSteps(steps: Omit<TraceStep, 'stepId' | 'timestamp'>[]): Promise<void> {
    if (steps.length === 0) return;

    const fullSteps: TraceStep[] = steps.map((s) =>
      filterPIIFromObject({
        ...s,
        stepId: uuidv4(),
        timestamp: Date.now(),
      })
    ) as TraceStep[];

    const updateParams: UpdateCommandInput = {
      TableName: this.getTableName(),
      Key: { traceId: this.traceId, nodeId: this.nodeId },
      UpdateExpression: 'SET #steps = list_append(if_not_exists(#steps, :empty_list), :steps)',
      ConditionExpression: this.workspaceId
        ? 'attribute_exists(traceId) AND workspaceId = :wsId'
        : 'attribute_exists(traceId)',
      ExpressionAttributeNames: { '#steps': 'steps' },
      ExpressionAttributeValues: {
        ':steps': fullSteps,
        ':empty_list': [],
      },
    };

    if (this.workspaceId) {
      const values = updateParams.ExpressionAttributeValues as Record<string, unknown>;
      values[':wsId'] = this.workspaceId;
    }

    await this.docClient.send(new UpdateCommand(updateParams));

    let totalTokens = 0;
    const toolNames = new Set<string>();

    steps.forEach((step) => {
      if (step.type === TRACE_TYPES.LLM_RESPONSE) {
        const content = step.content as {
          usage?: { total_tokens?: number; totalInputTokens?: number; totalOutputTokens?: number };
        };
        if (content?.usage) {
          totalTokens +=
            content.usage.total_tokens ||
            (content.usage.totalInputTokens ?? 0) + (content.usage.totalOutputTokens ?? 0);
        }
      } else if (step.type === TRACE_TYPES.TOOL_CALL) {
        const content = step.content as { toolName?: string; tool?: string };
        const toolName = content?.toolName || content?.tool;
        if (toolName) {
          toolNames.add(toolName);
        }
      }
    });

    const extra: Record<string, unknown> = {
      lastStepType: steps[steps.length - 1].type,
    };

    if (totalTokens > 0) extra.totalTokens = totalTokens;
    if (toolNames.size > 0) extra.toolNames = Array.from(toolNames);

    await this.updateSummary(TRACE_STATUS.STARTED, {
      extra,
    });
  }

  /**
   * Ends the trace node with a final response and optional metadata.
   *
   * @param finalResponse - The final response sent to the user.
   * @param metadata - Additional metadata for the trace.
   * @returns A promise that resolves when the trace is closed.
   */
  async endTrace(finalResponse: string, metadata?: Record<string, unknown>): Promise<void> {
    const endTime = Date.now();

    const updateParams: UpdateCommandInput = {
      TableName: this.getTableName(),
      Key: { traceId: this.traceId, nodeId: this.nodeId },
      UpdateExpression:
        'SET #status = :status, finalResponse = :resp, endTime = :end, metadata = :meta',
      ConditionExpression: this.workspaceId
        ? 'attribute_exists(traceId) AND workspaceId = :wsId'
        : 'attribute_exists(traceId)',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': TRACE_STATUS.COMPLETED,
        ':resp': finalResponse,
        ':end': endTime,
        ':meta': metadata ?? {},
      },
    };

    if (this.workspaceId) {
      const values = updateParams.ExpressionAttributeValues as Record<string, unknown>;
      values[':wsId'] = this.workspaceId;
    }

    await this.docClient.send(new UpdateCommand(updateParams));

    await this.updateSummary(TRACE_STATUS.COMPLETED, {
      extra: { finalResponse },
    });
    await this.emitCompletionMetrics(endTime, { success: true });
  }

  /**
   * Internal helper to emit agent-level metrics on trace completion/failure.
   */
  private async emitCompletionMetrics(
    endTime: number,
    options: { success?: boolean } = {}
  ): Promise<void> {
    const { success = true } = options;
    if (!this.agentId) return;

    try {
      const durationMs = endTime - this.startTime;
      const { emitMetrics } = await import('../metrics/metrics');
      const scope = {
        workspaceId: this.workspaceId,
        orgId: this.orgId,
        teamId: this.teamId,
        staffId: this.staffId,
      };
      await emitMetrics([
        METRICS.agentInvoked(this.agentId, success, scope),
        METRICS.agentDuration(this.agentId, durationMs, scope),
      ]);
    } catch (e) {
      logger.debug('Failed to emit trace completion metrics:', e);
    }
  }

  /**
   * Ends the trace node with a failure status.
   * Sh5: Critical for preventing 'Ghost Traces' when an agent crashes.
   *
   * @param reason - The failure reason or error message.
   * @param metadata - Additional failure context.
   */
  async failTrace(reason: string, metadata?: Record<string, unknown>): Promise<void> {
    const finalMetadata = { ...metadata, failureReason: reason };
    const endTime = Date.now();

    const updateParams: UpdateCommandInput = {
      TableName: this.getTableName(),
      Key: { traceId: this.traceId, nodeId: this.nodeId },
      UpdateExpression:
        'SET #status = :status, failureReason = :reason, endTime = :end, metadata = :meta',
      ConditionExpression: this.workspaceId
        ? 'attribute_exists(traceId) AND workspaceId = :wsId'
        : 'attribute_exists(traceId)',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': TRACE_STATUS.FAILED,
        ':reason': reason,
        ':end': endTime,
        ':meta': finalMetadata,
      },
    };

    if (this.workspaceId) {
      const values = updateParams.ExpressionAttributeValues as Record<string, unknown>;
      values[':wsId'] = this.workspaceId;
    }

    await this.docClient.send(new UpdateCommand(updateParams));

    await this.emitCompletionMetrics(endTime, { success: false });

    // Emit immediate failure event for monitoring to trigger real-time remediation
    try {
      const { emitEvent } = await import('../utils/bus');
      const { AGENT_TYPES, EventType } = await import('../types/agent');
      await emitEvent(AGENT_TYPES.RECOVERY, EventType.DASHBOARD_FAILURE_DETECTED, {
        userId: this.userId,
        traceId: this.traceId,
        agentId: this.agentId || 'unknown',
        task: 'System Operation',
        error: reason,
        metadata: finalMetadata,
        workspaceId: this.workspaceId,
        orgId: this.orgId,
        teamId: this.teamId,
        staffId: this.staffId,
        source: this.source === TraceSource.DASHBOARD ? TraceSource.DASHBOARD : TraceSource.SYSTEM,
      });
    } catch (e) {
      logger.warn('[Tracer] Failed to emit immediate failure event:', e);
    }

    await this.updateSummary(TRACE_STATUS.FAILED, {
      extra: { failureReason: reason },
    });
  }

  /**
   * Returns the current trace ID.
   *
   * @returns The trace ID string.
   */
  getTraceId(): string {
    return this.traceId;
  }

  /**
   * Returns the current node ID.
   *
   * @returns The node ID string.
   */
  getNodeId(): string {
    return this.nodeId;
  }

  /**
   * Returns the parent node ID.
   *
   * @returns The parent node ID string or undefined.
   */
  getParentId(): string | undefined {
    return this.parentId;
  }

  /**
   * Retrieves all nodes belonging to a specific traceId.
   * Includes workspaceId verification for multi-tenant isolation.
   *
   * @param traceId - The trace ID to retrieve.
   * @param workspaceId - Optional workspaceId for isolation check.
   * @returns A promise resolving to an array of trace nodes.
   */
  static async getTrace(traceId: string, workspaceId?: string): Promise<Trace[]> {
    if (!workspaceId && !process.env.VITEST) {
      logger.warn(`[ClawTracer] getTrace called without workspaceId for traceId: ${traceId}`);
    }

    const response = await getDocClient().send(
      new QueryCommand({
        TableName: getTraceTableName(),
        KeyConditionExpression: 'traceId = :tid',
        FilterExpression: workspaceId ? 'workspaceId = :ws' : undefined,
        ExpressionAttributeValues: {
          ':tid': traceId,
          ...(workspaceId ? { ':ws': workspaceId } : {}),
        },
      })
    );

    const items = (response.Items as Trace[]) ?? [];

    if (workspaceId && items.length > 0) {
      // Defense-in-depth: Ensure items match workspaceId even if FilterExpression was bypassed/ignored
      return items.filter((item) => item.workspaceId === workspaceId);
    }

    return items;
  }

  /**
   * Periodically checks for signal drift using the ConsistencyProbe.
   * Leverages on-demand activity to avoid background timers.
   * Also supports immediate drift detection for critical events.
   *
   * @param immediate - If true, triggers drift detection immediately regardless of elapsed time
   */
  async detectDrift(options: { immediate?: boolean } = {}): Promise<void> {
    const { immediate = false } = options;
    if (!this.agentId) return;

    if (immediate) {
      await this.performDriftCheck();
      return;
    }

    // Check drift once every 5 minutes per execution node
    const DRIFT_CHECK_THRESHOLD = 300000;
    const now = Date.now();

    if (now - this.startTime > DRIFT_CHECK_THRESHOLD) {
      await this.performDriftCheck();
    }
  }

  private async performDriftCheck(): Promise<void> {
    try {
      const { ConsistencyProbe } = await import('../metrics/cognitive-metrics');
      await ConsistencyProbe.detectDrift(this.agentId!);
    } catch (e) {
      logger.debug('[Tracer] Drift detection failed:', e);
    }
  }

  /**
   * Generic retry wrapper for best-effort secondary operations.
   */
  private async bestEffort(fn: () => Promise<void>, label: string): Promise<void> {
    try {
      await fn();
    } catch (e: unknown) {
      logger.warn(`[Tracer] Best-effort ${label} failed for ${this.traceId}:`, e);
      try {
        const { emitMetrics } = await import('../metrics/metrics');
        await emitMetrics([
          METRICS.storageError(
            label,
            e instanceof Error ? e.name : 'UnknownError',
            this.getTableName(),
            {
              workspaceId: this.workspaceId,
              orgId: this.orgId,
            }
          ),
        ]);
      } catch {
        // Suppress metrics emission errors to avoid infinite loops/nested failures
      }
    }
  }
}
