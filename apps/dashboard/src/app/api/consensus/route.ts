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

    const { DynamoMemory } = await import('@claw/core/lib/memory');
    const { getMemoryByType } = await import('@claw/core/lib/memory/utils/query');
    const memory = new DynamoMemory();
    // Use GSI for efficient querying instead of full table scan
    const items = await getMemoryByType(memory, 'CONSENSUS', 100, workspaceId);
    const requests = items.map((item) => ({
      id: item.userId as string,
      title: item.title ?? 'Consensus Request',
      description: item.description ?? '',
      status: item.status ?? 'PENDING',
      mode: item.mode ?? 'MAJORITY',
      votes: item.votes ?? [],
      timestamp: item.timestamp ?? 0,
      workspaceId: item.workspaceId || workspaceId,
    }));
    return NextResponse.json({ requests });
  } catch (e) {
    logger.error('Error fetching consensus:', e);
    return NextResponse.json(
      { requests: [], error: 'Failed to fetch consensus data' },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
