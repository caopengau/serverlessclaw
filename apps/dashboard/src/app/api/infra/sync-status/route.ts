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
    const memory = new DynamoMemory();
    // Use scoped prefix
    const items = await memory.listByPrefix(`WS#${workspaceId}#BUILD#`);
    const syncs = items.slice(0, 20).map((item) => ({
      buildId: item.buildId ?? (item.userId as string),
      status: item.status ?? 'PROGRESS',
      gapIds: item.gapIds ?? [],
      timestamp: item.timestamp ?? 0,
      commitHash: item.commitHash,
    }));
    return NextResponse.json({ syncs });
  } catch (e) {
    logger.error('Error fetching sync status:', e);
    return NextResponse.json(
      { syncs: [], error: 'Failed to fetch sync data' },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
