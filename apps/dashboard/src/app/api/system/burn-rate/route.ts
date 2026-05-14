/**
 * @module SystemBurnRateAPI
 * Returns the current token burn-rate for the current workspace.
 * Aggregates usage across all agents for the current UTC day within the workspace.
 */
import { getUserId } from '@/lib/auth-utils';
import { HTTP_STATUS } from '@claw/core/lib/constants';
import { logger } from '@claw/core/lib/logger';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
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

    const { BaseMemoryProvider } = await import('@claw/core/lib/memory/base');
    const { CONFIG_DEFAULTS } = await import('@claw/core/lib/config/config-defaults');
    const { ConfigManager } = await import('@claw/core/lib/registry/config');

    const memory = new BaseMemoryProvider();

    // List all token rollups for today, scoped to workspace
    // Format: WS#<workspaceId>#TOKEN_ROLLUP#<agentId>
    const rollups = await memory.listByPrefix(`WS#${workspaceId}#TOKEN_ROLLUP#`);

    const now = Date.now();
    const todayStart = new Date(now).setUTCHours(0, 0, 0, 0);

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let invocationCount = 0;

    for (const item of rollups) {
      // Only count rollups for today
      if ((item.timestamp as number) >= todayStart) {
        totalInputTokens += (item.totalInputTokens as number) ?? 0;
        totalOutputTokens += (item.totalOutputTokens as number) ?? 0;
        invocationCount += (item.invocationCount as number) ?? 0;
      }
    }

    const totalTokens = totalInputTokens + totalOutputTokens;

    // Get budget from config - scoped to workspace
    const budget = await ConfigManager.getTypedConfig(
      'global_token_budget',
      CONFIG_DEFAULTS.GLOBAL_TOKEN_BUDGET.code,
      { workspaceId }
    );

    // Calculate burn rate (tokens per hour over the day so far)
    const hoursSoFar = Math.max(1, (now - todayStart) / (1000 * 60 * 60));
    const burnRatePerHour = Math.round(totalTokens / hoursSoFar);

    return NextResponse.json({
      totalTokens,
      totalInputTokens,
      totalOutputTokens,
      invocationCount,
      dailyBudget: budget,
      burnRatePerHour,
      usageRatio: budget > 0 ? totalTokens / budget : 0,
      timestamp: now,
      workspaceId,
    });
  } catch (error) {
    logger.error('Burn Rate API Error:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
