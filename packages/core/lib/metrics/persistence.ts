import { MetricDatum } from './types';

const CRITICAL_METRICS = new Set([
  'AgentInvocations',
  'AgentDuration',
  'DeploymentStarted',
  'DeploymentCompleted',
  'CircuitBreakerTriggered',
  'RateLimitExceeded',
  'DLQEvents',
  'EventHandlerInvoked',
  'EventHandlerDuration',
  'EventHandlerErrorDuration',
  'StorageError',
  'EvolutionTrustDelta',
  'EvolutionTrustScore',
  'EvolutionFailedPlanCount',
  'MetabolismRepairCount',
]);

/**
 * Persists critical metrics to DynamoDB as a durable fallback.
 */
export async function persistToDynamoDB(metrics: MetricDatum[]): Promise<void> {
  const critical = metrics.filter((m) => CRITICAL_METRICS.has(m.MetricName));
  if (critical.length === 0) return;

  try {
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    const ddbUtils = (await import('../utils/ddb-client').catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (
      typeof ddbUtils.getDocClient !== 'function' ||
      typeof ddbUtils.getMemoryTableName !== 'function'
    ) {
      return; // Silent skip if environment/mocks are incomplete
    }

    const docClient = (
      ddbUtils.getDocClient as () => { send: (cmd: unknown) => Promise<unknown> }
    )();
    const tableName = (ddbUtils.getMemoryTableName as () => string | undefined)();
    if (!tableName) return;

    const now = Date.now();
    for (const m of critical) {
      const workspaceId = m.Dimensions?.find((d) => d.Name === 'WorkspaceId')?.Value;
      const scopePrefix = workspaceId ? `WS#${workspaceId}#` : '';

      await docClient.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            userId: `${scopePrefix}METRIC#${m.MetricName}`,
            timestamp: now + Math.random(),
            type: 'METRIC',
            metricName: m.MetricName,
            value: m.Value,
            unit: m.Unit ?? 'Count',
            dimensions: m.Dimensions,
            workspaceId,
            expiresAt: Math.floor(now / 1000) + 7 * 86400,
          },
          ConditionExpression: 'attribute_not_exists(userId)',
        })
      );
    }
  } catch (e) {
    try {
      const { logger } = await import('../logger');
      logger.error('[METRICS] Critical DynamoDB fallback failed', {
        error: e,
        metricCount: critical.length,
      });
    } catch {
      console.error('[METRICS] DynamoDB fallback failed and logger unavailable:', e);
    }
  }
}
