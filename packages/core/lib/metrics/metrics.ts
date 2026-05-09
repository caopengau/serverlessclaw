/**
 * CloudWatch Metrics Module
 */

import { persistToDynamoDB } from './persistence';
import { MetricDatum } from './types';

const NAMESPACE = 'ServerlessClaw';

interface CloudWatchClientType {
  send: (command: unknown) => Promise<unknown>;
}

let cloudwatch: CloudWatchClientType | null = null;

async function getCloudWatchClient(): Promise<CloudWatchClientType | null> {
  if (cloudwatch) return cloudwatch;
  try {
    const { CloudWatchClient } = await import('@aws-sdk/client-cloudwatch');
    cloudwatch = new CloudWatchClient({}) as CloudWatchClientType;
    return cloudwatch;
  } catch {
    return null;
  }
}

export { type MetricDatum };

/**
 * Emits metrics to CloudWatch or falls back to DynamoDB.
 */
export async function emitMetrics(metrics: MetricDatum[]): Promise<void> {
  if (metrics.length === 0) return;

  const cw = await getCloudWatchClient();
  if (!cw) {
    const { logger } = await import('../logger');
    logger.warn('[METRICS] CloudWatch not available, persisting critical metrics to DynamoDB');
    await persistToDynamoDB(metrics);
    return;
  }

  try {
    const { PutMetricDataCommand } = await import('@aws-sdk/client-cloudwatch');
    const command = new PutMetricDataCommand({
      Namespace: NAMESPACE,
      MetricData: metrics.map((m) => ({
        MetricName: m.MetricName,
        Value: m.Value,
        Unit: m.Unit || 'Count',
        Dimensions: m.Dimensions,
        Timestamp: new Date(),
      })),
    });
    await cw.send(command);
  } catch (error) {
    const { logger } = await import('../logger');
    logger.error('[METRICS] Failed to emit CloudWatch metrics, falling back to DynamoDB', {
      error,
    });
    await persistToDynamoDB(metrics);
  }
}

export * from './registry';
