import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { HTTP_STATUS } from '@claw/core/lib/constants';
import { logger } from '@claw/core/lib/logger';
import { getMemoryTableName } from '@claw/core/lib/utils/ddb-client';
import { getUserId } from '@/lib/auth-utils';

/**
 * GET: Lists all active distributed locks for a workspace.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
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

    const tableName = getMemoryTableName();
    if (!tableName) {
      return NextResponse.json(
        { error: 'MemoryTable not found' },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }

    const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    const { Items } = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: 'begins_with(userId, :prefix) OR (begins_with(userId, :scopedPrefix))',
        ExpressionAttributeValues: {
          ':prefix': 'LOCK#',
          ':scopedPrefix': `WS#${workspaceId}#LOCK#`,
        },
      })
    );

    const locks = (Items ?? [])
      .filter((item) => {
        // If it's a scoped lock, ensure it matches the workspaceId
        if (item.userId.startsWith('WS#')) {
          return item.userId.startsWith(`WS#${workspaceId}#`);
        }
        // If it's a legacy unscoped lock, we only show it if the workspaceId is 'default'
        // OR if we want to allow admins to see global locks (for now we strictly scope)
        return workspaceId === 'default' || workspaceId === 'global';
      })
      .map((item) => ({
        lockId: item.userId.includes('LOCK#') ? item.userId.split('LOCK#').pop() : item.userId,
        rawId: item.userId,
        expiresAt: item.expiresAt,
        acquiredAt: item.acquiredAt,
        timestamp: item.timestamp,
        isExpired: item.expiresAt < Math.floor(Date.now() / 1000),
        workspaceId:
          item.workspaceId ||
          (item.userId.startsWith('WS#') ? item.userId.split('#')[1] : 'global'),
      }))
      .sort((a, b) => b.acquiredAt - a.acquiredAt);

    return NextResponse.json({ locks });
  } catch (error) {
    logger.error('Error fetching locks:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch locks',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}

/**
 * DELETE: Force-releases a specific lock.
 *
 * @param req - The incoming DELETE request with lock details.
 */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = getUserId(req);
    const { searchParams } = new URL(req.url);
    const workspaceId =
      searchParams.get('workspaceId') || req.headers.get('x-workspace-id') || 'default';
    const rawId = searchParams.get('lockId');

    if (!rawId) {
      return NextResponse.json(
        { error: 'Missing lockId parameter' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const { getIdentityManager, Permission } = await import('@claw/core/lib/session/identity');
    const identityManager = await getIdentityManager();

    // Verify delete permission
    const hasPermission = await identityManager.hasPermission(
      userId,
      Permission.AGENT_DELETE,
      workspaceId
    );
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Unauthorized to release locks' },
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }

    // Verify that the lock belongs to the workspace
    if (rawId.startsWith('WS#') && !rawId.startsWith(`WS#${workspaceId}#`)) {
      return NextResponse.json(
        { error: 'Lock belongs to another workspace' },
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }

    const tableName = getMemoryTableName();
    if (!tableName) {
      return NextResponse.json(
        { error: 'MemoryTable not found' },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }

    const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    await docClient.send(
      new DeleteCommand({
        TableName: tableName,
        Key: { userId: rawId, timestamp: 0 },
      })
    );

    return NextResponse.json({ success: true, lockId: rawId });
  } catch (error) {
    logger.error('Error releasing lock:', error);
    return NextResponse.json(
      {
        error: 'Failed to release lock',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
