import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth-utils';
import { getNotificationManager } from '@claw/core/lib/services/notification-manager';
import { HTTP_STATUS } from '@claw/core/lib/constants';
import { logger } from '@claw/core/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications
 * Lists notifications for the current user in a workspace.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const userId = getUserId(req);
  const workspaceId = req.nextUrl.searchParams.get('workspaceId') || 'default';
  const unreadOnly = req.nextUrl.searchParams.get('unreadOnly') === 'true';
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);

  try {
    const notificationManager = getNotificationManager();
    const notifications = await notificationManager.listNotifications(userId, workspaceId, {
      limit,
      unreadOnly,
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    logger.error(`[Notifications API] GET Error:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}

/**
 * PATCH /api/notifications
 * Marks a notification as read or all as read.
 */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const userId = getUserId(req);
  try {
    const { workspaceId = 'default', timestamp, all = false } = await req.json();
    const notificationManager = getNotificationManager();

    if (all) {
      await notificationManager.markAllAsRead(userId, workspaceId);
    } else if (timestamp) {
      await notificationManager.markAsRead(userId, workspaceId, timestamp);
    } else {
      return NextResponse.json(
        { error: 'Missing timestamp or all flag' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(`[Notifications API] PATCH Error:`, error);
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}

/**
 * DELETE /api/notifications
 * Deletes a notification.
 */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const userId = getUserId(req);
  const workspaceId = req.nextUrl.searchParams.get('workspaceId') || 'default';
  const timestamp = parseInt(req.nextUrl.searchParams.get('timestamp') || '', 10);

  if (!timestamp) {
    return NextResponse.json({ error: 'Missing timestamp' }, { status: HTTP_STATUS.BAD_REQUEST });
  }

  try {
    const notificationManager = getNotificationManager();
    await notificationManager.deleteNotification(userId, workspaceId, timestamp);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(`[Notifications API] DELETE Error:`, error);
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
