import { logger } from '@claw/core/lib/logger';
import { getUserId } from '@/lib/auth-utils';
import { HTTP_STATUS } from '@claw/core/lib/constants';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const { searchParams } = new URL(request.url);
    const workspaceId =
      searchParams.get('workspaceId') || request.headers.get('x-workspace-id') || 'default';
    const days = Math.min(parseInt(searchParams.get('days') ?? '7', 10), 90);
    const agentId = searchParams.get('agentId') ?? undefined;

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

    const { TokenTracker } = await import('@claw/core/lib/metrics/token-usage');
    const { DynamoMemory } = await import('@claw/core/lib/memory');
    const memory = new DynamoMemory();

    const agents = ['superclaw', 'coder', 'strategic-planner', 'cognition-reflector', 'qa'];
    const targetAgents = agentId ? [agentId] : agents;

    // Fetch token rollups per agent in parallel - scoped to workspace
    const tokenData: Record<string, unknown[]> = {};
    await Promise.all(
      targetAgents.map(async (agent) => {
        const rollups = await TokenTracker.getRollupRange(agent, days, { workspaceId });
        tokenData[agent] = rollups.map((r) => ({
          date: new Date(r.timestamp).toISOString().slice(0, 10),
          totalInputTokens: r.totalInputTokens,
          totalOutputTokens: r.totalOutputTokens,
          invocationCount: r.invocationCount,
          avgTokensPerInvocation: r.avgTokensPerInvocation,
          successCount: r.successCount,
        }));
      })
    );

    // Fetch tool usage - scoped to workspace
    const toolUsageItem = await (
      memory as import('@claw/core/lib/types/memory/interfaces').IMemory
    ).getConfig('tool_usage_global', { workspaceId });
    const toolUsage = toolUsageItem
      ? Object.entries(toolUsageItem)
          .filter(([key]) => !['userId', 'timestamp', 'type', 'workspaceId'].includes(key))
          .map(([toolName, stats]) => ({
            toolName,
            ...(typeof stats === 'object' && stats !== null ? stats : {}),
          }))
      : [];

    // Fetch recent cognitive health metrics - scoped to workspace using GSI
    const { getMemoryByType } = await import('@claw/core/lib/memory/utils/query');
    const healthItems = await getMemoryByType(memory, 'COGNITIVE_METRIC', 500, workspaceId);
    const recentMetrics = healthItems
      .filter((item) => {
        const ts = (item.timestamp as number) ?? 0;
        const cutoff = Date.now() - days * 86400000;
        return ts > cutoff;
      })
      .map((item) => {
        const rawUserId = (item.userId as string) ?? '';
        const agentId = rawUserId.split('HEALTH#METRIC#').pop() || 'unknown';
        return {
          agentId,
          metricName: item.metricName,
          value: item.value,
          timestamp: item.timestamp,
        };
      });

    return NextResponse.json({
      tokenUsage: tokenData,
      toolUsage,
      cognitiveMetrics: recentMetrics,
      meta: { days, agentId: agentId ?? 'all', workspaceId },
    });
  } catch (e) {
    logger.error('Error fetching analytics:', e);
    return NextResponse.json(
      {
        error: 'Failed to fetch analytics data',
        details: e instanceof Error ? e.message : String(e),
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
