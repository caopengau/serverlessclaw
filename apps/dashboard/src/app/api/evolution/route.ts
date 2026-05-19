import { NextRequest, NextResponse } from 'next/server';
import { HTTP_STATUS } from '@claw/core/lib/constants';
import { logger } from '@claw/core/lib/logger';
import { BaseMemoryProvider } from '@claw/core/lib/memory/base';
import { EvolutionScheduler, PendingEvolution } from '@claw/core/lib/safety/evolution-scheduler';
import { cookies } from 'next/headers';

import { getUserId } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

/**
 * GET handler to list pending evolutions.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const { searchParams } = new URL(request.url);
    const workspaceId =
      searchParams.get('workspaceId') ||
      request.headers.get('x-workspace-id') ||
      (await cookies()).get('workspaceId')?.value ||
      'default';

    const { getIdentityManager, Permission } = await import('@claw/core/lib/session/identity');
    const identityManager = await getIdentityManager();

    // Verify workspace access (Principle 11)
    const hasAccess = await identityManager.hasPermission(
      userId,
      Permission.EVOLUTION_VIEW,
      workspaceId
    );
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Unauthorized workspace access' },
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }

    const memory = new BaseMemoryProvider();

    // Using the same IndexName from EvolutionScheduler's triggerTimedOutActions
    // but without the expiresAt filter because we want all pending actions.
    // Fixed Anti-Pattern 19: FilterExpression on workspaceId is slow and insecure if not used with KeyCondition.
    // Here we use it as a filter but ensure it's combined with a proper type key.
    const items = await memory.queryItems({
      IndexName: 'TypeTimestampIndex',
      KeyConditionExpression: '#tp = :type',
      FilterExpression: '#status = :pending AND workspaceId = :workspaceId',
      ExpressionAttributeNames: {
        '#tp': 'type',
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':type': 'PENDING_EVOLUTION',
        ':pending': 'pending',
        ':workspaceId': workspaceId,
      },
    });

    const pendingActions = items as unknown as PendingEvolution[];
    return NextResponse.json(pendingActions);
  } catch (error) {
    logger.error('Failed to fetch pending evolutions:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch pending evolutions',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}

/**
 * PATCH handler to approve or reject a pending evolution.
 */
export async function PATCH(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const body = await request.json();
    const { actionId, status } = body;

    if (!actionId || !status || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId =
      body.workspaceId ||
      searchParams.get('workspaceId') ||
      request.headers.get('x-workspace-id') ||
      (await cookies()).get('workspaceId')?.value ||
      'default';

    const { getIdentityManager, Permission } = await import('@claw/core/lib/session/identity');
    const identityManager = await getIdentityManager();

    // Verify workspace access (Principle 11)
    const hasAccess = await identityManager.hasPermission(
      userId,
      Permission.EVOLUTION_APPROVE,
      workspaceId
    );
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Unauthorized workspace access' },
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }

    const memory = new BaseMemoryProvider();
    const scheduler = new EvolutionScheduler(memory);

    await scheduler.updateStatus(actionId, status, workspaceId);

    return NextResponse.json({ success: true, actionId, status });
  } catch (error) {
    logger.error('Failed to update pending evolution:', error);
    return NextResponse.json(
      {
        error: 'Failed to update pending evolution',
        details: error instanceof Error ? error.message : String(error),
      },
      {
        status:
          error instanceof Error && error.message === 'Unauthorized access to pending evolution'
            ? HTTP_STATUS.FORBIDDEN
            : HTTP_STATUS.INTERNAL_SERVER_ERROR,
      }
    );
  }
}
