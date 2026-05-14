/**
 * @module ResilienceMetricsAPI
 * Returns aggregated resilience metrics for the dashboard gauge HUD.
 *
 * Note: Resilience metrics tracks recovery operations (DISTILLED#RECOVERY).
 * Task success rate is tracked separately via SLOTracker in core.
 * These are complementary - resilience tracks recovery, SLO tracks task completion.
 */
import { getUserId } from '@/lib/auth-utils';
import { HTTP_STATUS } from '@claw/core/lib/constants';
import { logger } from '@claw/core/lib/logger';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export const GET = async (req: NextRequest) => {
  try {
    const userId = getUserId(req);
    const { searchParams } = new URL(req.url);
    const workspaceId =
      searchParams.get('workspaceId') || req.headers.get('x-workspace-id') || 'default';

    const { getIdentityManager, Permission } = await import('@claw/core/lib/session/identity');
    const identityManager = await getIdentityManager();

    // Verify workspace access
    const hasAccess = await identityManager.hasPermission(
      userId,
      Permission.AGENT_VIEW,
      workspaceId
    );
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Unauthorized workspace access' },
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }

    const { DynamoMemory } = await import('@claw/core/lib/memory');
    const { getCircuitBreaker } = await import('@claw/core/lib/safety/circuit-breaker');
    const memory = new DynamoMemory();

    // Fetch real circuit breaker state for deployments - scoped to workspace
    const cb = getCircuitBreaker('deploy', workspaceId);
    const cbState = await cb.getState();

    // Fetch recovery logs - scoped to workspace
    const recoveryLogs = await memory.listByPrefix(`WS#${workspaceId}#DISTILLED#RECOVERY`);
    const recoveryCount = recoveryLogs.length;
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    const recentLogs = recoveryLogs.filter(
      (log) => now - (log.timestamp as number) < twentyFourHours
    );
    const recentFailures = recentLogs.filter(
      (log) => (log as Record<string, unknown>).outcome === 'failure'
    ).length;
    const recentSuccesses = recentLogs.filter(
      (log) => (log as Record<string, unknown>).outcome === 'success'
    ).length;
    const recentTotal = recentLogs.length;

    // Health score: success rate over the last 24h (volume-normalized)
    const healthScore =
      recentTotal > 0 ? Math.round(((recentTotal - recentFailures) / recentTotal) * 100) : 100;

    // Error rate: percentage of recent operations that failed
    const errorRate = recentTotal > 0 ? Math.round((recentFailures / recentTotal) * 100) : 0;

    // Recovery success: percentage of recent failures that were subsequently resolved
    const recoverySuccess =
      recentFailures > 0
        ? Math.round((recentSuccesses / (recentFailures + recentSuccesses)) * 100)
        : 100;

    return NextResponse.json({
      healthScore: Math.max(0, Math.min(100, healthScore)),
      errorRate: Math.max(0, Math.min(100, errorRate)),
      recoverySuccess: Math.max(0, Math.min(100, recoverySuccess)),
      recoveryCount,
      recentTotal,
      recentFailures,
      recentSuccesses,
      circuitBreaker: {
        state: cbState.state,
        lastFailure: cbState.lastFailureTime,
        failureCount: cbState.failures.length,
        emergencyDeployCount: cbState.emergencyDeployCount,
      },
      lastUpdated: now,
    });
  } catch (error) {
    logger.error('Resilience Metrics API Error:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
};
