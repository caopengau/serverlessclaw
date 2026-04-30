import { logger } from '../../lib/logger';
import { EventType } from '../../lib/types/agent';
import type { BaseMemoryProvider } from '../../lib/memory/base';

/**
 * Handles cognitive health check events.
 * Takes a cognitive health snapshot and alerts if the score is below threshold.
 *
 * @param eventDetail - The event detail payload containing optional agentIds to check.
 */
export async function handleCognitiveHealthCheck(
  eventDetail: Record<string, unknown>
): Promise<void> {
  const { CognitiveHealthMonitor } = await import('../../lib/metrics/cognitive-metrics');
  const { DynamoMemory } = await import('../../lib/memory');

  const memory = new DynamoMemory();
  const monitor = new CognitiveHealthMonitor(memory as unknown as BaseMemoryProvider);
  monitor.start();

  try {
    const { listWorkspaceIds } = await import('../../lib/memory/workspace-operations');
    const workspaceIds = await listWorkspaceIds();

    // Check global agents
    const globalSnapshot = await monitor.takeSnapshot(eventDetail.agentIds as string[]);
    logger.info(
      `[HEALTH] Global cognitive health snapshot: score=${globalSnapshot.overallScore}, anomalies=${globalSnapshot.anomalies.length}`
    );
    if (globalSnapshot.overallScore < 70) {
      await alertDegradedHealth(globalSnapshot, 'Global');
    }

    // Check each workspace
    for (const workspaceId of workspaceIds) {
      const workspaceSnapshot = await monitor.takeSnapshot(
        eventDetail.agentIds as string[],
        workspaceId
      );
      if (workspaceSnapshot.overallScore < 70) {
        logger.warn(
          `[HEALTH] Workspace ${workspaceId} cognitive health degraded: score=${workspaceSnapshot.overallScore}`
        );
        await alertDegradedHealth(workspaceSnapshot, `Workspace:${workspaceId}`, workspaceId);
      }
    }
  } catch (error) {
    logger.error('Failed to perform multi-tenant cognitive health check:', error);
  } finally {
    monitor.stop();
  }
}

/**
 * Alerts when health is degraded.
 */
async function alertDegradedHealth(
  snapshot: any,
  label: string,
  workspaceId?: string
): Promise<void> {
  const { emitEvent } = await import('../../lib/utils/bus');
  const criticalAnomalies = snapshot.anomalies.filter(
    (a: any) => a.severity === 'critical' || a.severity === 'high'
  );

  try {
    await emitEvent('cognitive-health', EventType.SYSTEM_HEALTH_REPORT, {
      component: 'CognitiveHealthMonitor',
      issue: `[${label}] Cognitive health score dropped to ${snapshot.overallScore}/100. ${criticalAnomalies.length} critical anomalies detected.`,
      severity: snapshot.overallScore < 50 ? 'critical' : 'high',
      workspaceId,
      context: {
        overallScore: snapshot.overallScore,
        anomalyCount: snapshot.anomalies.length,
        criticalCount: criticalAnomalies.length,
        agentMetrics: snapshot.agentMetrics.map((m: any) => ({
          agentId: m.agentId,
          completionRate: m.taskCompletionRate,
          errorRate: m.errorRate,
        })),
      },
    });
  } catch (error) {
    logger.error(`Failed to emit cognitive health alert for ${label}:`, error);
  }
}
