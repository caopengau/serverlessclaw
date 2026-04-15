import { Resource } from 'sst';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../../logger';
import { MEMORY_KEYS } from '../../constants';
import { BaseMemoryProvider } from '../../memory/base';
import { DynamoMemory } from '../../memory/dynamo-memory';
import { SSTResource } from '../../types/system';

/**
 * Silo 5: The Eye - Observation & Consistency Probe
 * Verifies that the internal system state matches reported metrics
 * and that no signal drift has occurred between backend and dashboard.
 */
export class ConsistencyProbe {
  private base: BaseMemoryProvider;

  constructor(base: BaseMemoryProvider) {
    this.base = base;
  }

  /**
   * Run a consistency check for a specific agent's traces.
   * Compares raw trace counts in DynamoDB with the aggregated metrics.
   */
  async verifyTraceConsistency(
    agentId: string,
    windowStart: number,
    windowEnd: number
  ): Promise<{
    consistent: boolean;
    drift: number;
    details: string;
  }> {
    // 1. Get raw task completions from metrics table
    const items = await this.base.queryItems({
      KeyConditionExpression: 'userId = :pk AND #ts BETWEEN :start AND :end',
      FilterExpression: 'metricName = :name',
      ExpressionAttributeNames: { '#ts': 'timestamp' },
      ExpressionAttributeValues: {
        ':pk': `${MEMORY_KEYS.HEALTH_PREFIX}METRIC#${agentId}`,
        ':start': windowStart,
        ':end': windowEnd,
        ':name': 'task_completed',
      },
    });

    const metricsCount = items.length;

    // 2. Verify internal consistency: task_completed vs task_latency_ms should be 1:1
    const latencyItems = await this.base.queryItems({
      KeyConditionExpression: 'userId = :pk AND #ts BETWEEN :start AND :end',
      FilterExpression: 'metricName = :name',
      ExpressionAttributeNames: { '#ts': 'timestamp' },
      ExpressionAttributeValues: {
        ':pk': `${MEMORY_KEYS.HEALTH_PREFIX}METRIC#${agentId}`,
        ':start': windowStart,
        ':end': windowEnd,
        ':name': 'task_latency_ms',
      },
    });

    const latencyCount = latencyItems.length;
    const internalDrift = Math.abs(metricsCount - latencyCount);

    // 3. Cross-reference with TraceTable for end-to-end verification
    const traceCount = await this.getTraceCountFromTable(agentId, windowStart, windowEnd);
    const traceDrift = traceCount > 0 ? Math.abs(metricsCount - traceCount) : 0;
    const totalDrift = internalDrift + traceDrift;

    return {
      consistent: totalDrift === 0,
      drift: totalDrift,
      details: this.buildConsistencyDetails(
        metricsCount,
        latencyCount,
        traceCount,
        internalDrift,
        traceDrift
      ),
    };
  }

  /**
   * Query TraceTable for actual trace counts within the time window using AgentIdIndex GSI.
   */
  private async getTraceCountFromTable(
    agentId: string,
    windowStart: number,
    windowEnd: number
  ): Promise<number> {
    try {
      const typedResource = Resource as unknown as SSTResource;
      const tableName = typedResource.TraceTable?.name;
      if (!tableName) {
        logger.debug('TraceTable not available in resources');
        return 0;
      }

      const client = new DynamoDBClient({});
      const docClient = DynamoDBDocumentClient.from(client, {
        marshallOptions: { removeUndefinedValues: true },
      });

      const response = await docClient.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: 'AgentIdIndex',
          KeyConditionExpression: 'agentId = :agentId AND #ts BETWEEN :start AND :end',
          ExpressionAttributeNames: { '#ts': 'timestamp' },
          ExpressionAttributeValues: {
            ':agentId': agentId,
            ':start': windowStart,
            ':end': windowEnd,
          },
          Select: 'COUNT',
        })
      );

      return response.Count ?? 0;
    } catch (e) {
      logger.debug('Failed to query TraceTable for consistency check:', e);
      return 0;
    }
  }

  /**
   * Build human-readable consistency details.
   */
  private buildConsistencyDetails(
    metricsCount: number,
    latencyCount: number,
    traceCount: number,
    internalDrift: number,
    traceDrift: number
  ): string {
    const parts: string[] = [];

    if (internalDrift === 0) {
      parts.push(
        `Internal metrics consistent (${metricsCount} task completions, ${latencyCount} latency records)`
      );
    } else {
      parts.push(
        `INTERNAL DRIFT: ${internalDrift} - task completions (${metricsCount}) vs latency records (${latencyCount})`
      );
    }

    if (traceDrift === 0 || traceCount === 0) {
      parts.push(
        `TraceTable cross-reference: ${traceCount > 0 ? 'consistent' : 'unavailable (requires agentId GSI)'}`
      );
    } else {
      parts.push(
        `TRACE DRIFT: ${traceDrift} - metrics (${metricsCount}) vs actual traces (${traceCount})`
      );
    }

    return parts.join('. ');
  }

  /**
   * Static helper for quick drift detection (default: last 1 hour).
   */
  static async detectDrift(agentId: string, memory?: BaseMemoryProvider): Promise<boolean> {
    const provider = memory ?? new DynamoMemory();
    const probe = new ConsistencyProbe(provider);
    const now = Date.now();
    const result = await probe.verifyTraceConsistency(agentId, now - 3600000, now);

    if (!result.consistent && result.drift > 0) {
      logger.warn(`[Silo 5] Signal drift detected for agent ${agentId}: ${result.details}`);

      // Emit immediate failure event for monitoring to trigger real-time remediation
      try {
        const { emitEvent } = await import('../../utils/bus');
        const { AgentType, EventType, TraceSource } = await import('../../types/agent');
        await emitEvent(AgentType.RECOVERY, EventType.DASHBOARD_FAILURE_DETECTED, {
          userId: 'SYSTEM',
          traceId: `drift-${agentId}-${Date.now()}`,
          agentId,
          task: 'Consistency Check',
          error: `SIGNAL_DRIFT: ${result.details}`,
          metadata: { drift: result.drift, windowMs: 3600000 },
          source: TraceSource.SYSTEM,
        });
      } catch (e) {
        logger.warn('[Probe] Failed to emit drift remediation event:', e);
      }
    } else {
      logger.info(
        `[Silo 5] Trace consistency verified for agent ${agentId}. Drift: ${result.drift}`
      );
    }

    return !result.consistent;
  }
}
