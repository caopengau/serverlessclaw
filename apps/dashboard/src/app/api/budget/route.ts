import { logger } from '@claw/core/lib/logger';
import { getUserId } from '@/lib/auth-utils';
import { HTTP_STATUS } from '@claw/core/lib/constants';
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

    const { EvolutionTrack } = await import('@claw/core/lib/types/agent');
    const { DynamoMemory } = await import('@claw/core/lib/memory');
    const memory = new DynamoMemory();

    const configItem = (await (
      memory as import('@claw/core/lib/types/memory/interfaces').IMemory
    ).getConfig('track_evolution_budget', {
      workspaceId,
    })) as {
      budgets?: unknown[];
      maxTotalBudgetUsd?: number;
    } | null;
    const budgets =
      configItem?.budgets ??
      Object.values(EvolutionTrack).map((track) => ({
        track,
        allocated: 2.0,
        spent: 0,
      }));

    return NextResponse.json({
      budgets,
      maxTotalBudgetUsd: configItem?.maxTotalBudgetUsd ?? 10.0,
      workspaceId,
    });
  } catch (e) {
    logger.error('Error fetching budget:', e);
    return NextResponse.json(
      { budgets: [], maxTotalBudgetUsd: 10.0, error: 'Failed to fetch budget data' },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
