import { NextRequest, NextResponse } from 'next/server';
import { HTTP_STATUS } from '@claw/core/lib/constants';
import { getToolUsage, getAllTools } from '@/lib/tool-utils';
import { logger } from '@claw/core/lib/logger';
import { getUserId } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

// moved helpers to dashboard/src/lib/tool-utils.ts

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get('refresh') === 'true';
    const workspaceId =
      searchParams.get('workspaceId') || request.headers.get('x-workspace-id') || 'default';

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

    const usage = await getToolUsage({ workspaceId });
    const allTools = await getAllTools(usage, { forceRefresh: refresh, workspaceId });
    return NextResponse.json({ tools: allTools });
  } catch (error) {
    logger.error('Failed to fetch tools:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tools' },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
