import { BaseMemoryProvider } from '../memory/base';
import { Notification, NotificationStatus, CreateNotificationParams } from '../types/notification';
import { generateId } from '../utils/id-generator';
import { RETENTION } from '../constants';
import { logger } from '../logger';
import { emitEvent } from '../utils/bus/emitters';
import { QueryCommandInput } from '@aws-sdk/lib-dynamodb';

const NOTIF_PREFIX = 'NOTIF#';
const NOTIF_TTL_SECONDS = (RETENTION.SESSION_METADATA_DAYS || 90) * 24 * 60 * 60;

/**
 * Manages cross-human and cross-agent notifications.
 * Implements persistent storage in MemoryTable and real-time event emission.
 */
export class NotificationManager {
  constructor(private base: BaseMemoryProvider = new BaseMemoryProvider()) {}

  /**
   * Derives the scoped partition key for notifications.
   */
  private getNotifKey(userId: string, workspaceId: string): string {
    return this.base.getScopedUserId(`${NOTIF_PREFIX}${userId}`, { workspaceId });
  }

  /**
   * Creates a new notification, persists it, and emits a real-time event.
   */
  async createNotification(params: CreateNotificationParams): Promise<Notification> {
    const id = generateId('notif');
    const now = Date.now();
    // Ensure chronological order and uniqueness with micro-jitter
    const timestamp = now * 1000 + Math.floor(Math.random() * 1000);
    const expiresAt = Math.floor(now / 1000) + NOTIF_TTL_SECONDS;

    const notification: Notification = {
      id,
      ...params,
      status: NotificationStatus.UNREAD,
      timestamp,
      expiresAt,
    };

    try {
      await this.base.putItem({
        userId: this.getNotifKey(params.receiverId, params.workspaceId),
        ...notification,
        workspaceId: params.workspaceId, // Redundant but good for indexing
      });

      // Emit event for real-time delivery via MQTT bridge
      await emitEvent('notification.service', 'notification.created', {
        ...notification,
        traceId: `notif-${id}`,
      });

      logger.info(
        `Notification ${id} created for user ${params.receiverId} in WS ${params.workspaceId}`
      );
      return notification;
    } catch (error) {
      logger.error(`Failed to create notification ${id}:`, error);
      throw error;
    }
  }

  /**
   * Lists notifications for a specific user within a workspace.
   */
  async listNotifications(
    userId: string,
    workspaceId: string,
    options: { limit?: number; unreadOnly?: boolean } = {}
  ): Promise<Notification[]> {
    const key = this.getNotifKey(userId, workspaceId);
    const { limit = 50, unreadOnly = false } = options;

    const queryParams: QueryCommandInput = {
      TableName: '', // Will be set by base provider
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': key,
      },
      ScanIndexForward: false, // Recent first
      Limit: limit,
    };

    if (unreadOnly) {
      queryParams.FilterExpression = '#status = :unread';
      queryParams.ExpressionAttributeNames = { '#status': 'status' };
      if (queryParams.ExpressionAttributeValues) {
        queryParams.ExpressionAttributeValues[':unread'] = NotificationStatus.UNREAD;
      }
    }

    try {
      const result = await this.base.queryItemsPaginated(queryParams as Record<string, unknown>);
      return (result.items as unknown as Notification[]) || [];
    } catch (error) {
      logger.error(`Failed to list notifications for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Marks a specific notification as read.
   */
  async markAsRead(userId: string, workspaceId: string, timestamp: number): Promise<void> {
    const key = this.getNotifKey(userId, workspaceId);
    try {
      await this.base.updateItem({
        Key: { userId: key, timestamp },
        UpdateExpression: 'SET #status = :read',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':read': NotificationStatus.READ },
      });
      logger.info(`Notification at ${timestamp} marked as read for user ${userId}`);
    } catch (error) {
      logger.error(`Failed to mark notification as read for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Deletes a notification.
   */
  async deleteNotification(userId: string, workspaceId: string, timestamp: number): Promise<void> {
    const key = this.getNotifKey(userId, workspaceId);
    try {
      await this.base.deleteItem({ userId: key, timestamp });
      logger.info(`Notification at ${timestamp} deleted for user ${userId}`);
    } catch (error) {
      logger.error(`Failed to delete notification for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Marks all notifications for a user as read.
   */
  async markAllAsRead(userId: string, workspaceId: string): Promise<void> {
    const notifications = await this.listNotifications(userId, workspaceId, { unreadOnly: true });
    if (notifications.length === 0) return;

    // Batch update is not supported by putItem/updateItem directly in base,
    // so we iterate. For high volume, we'd use BatchWriteItem.
    for (const notif of notifications) {
      await this.markAsRead(userId, workspaceId, notif.timestamp);
    }
  }
}

let notificationManager: NotificationManager | undefined;

export function getNotificationManager(): NotificationManager {
  if (!notificationManager) {
    notificationManager = new NotificationManager();
  }
  return notificationManager;
}
