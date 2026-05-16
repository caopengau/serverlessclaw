import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationManager } from './notification-manager';
import { NotificationType, NotificationStatus, ResourceType } from '../types/notification';
import { emitEvent } from '../utils/bus/emitters';

// Mock dependencies
vi.mock('../memory/base');
vi.mock('../utils/bus/emitters');
vi.mock('../utils/id-generator', () => ({
  generateId: (prefix: string) => `${prefix}_mock_id`,
}));

describe('NotificationManager', () => {
  let notificationManager: NotificationManager;
  let mockMemoryProvider: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // We mock the provider and the methods we'll use
    mockMemoryProvider = {
      putItem: vi.fn().mockResolvedValue({}),
      queryItemsPaginated: vi.fn(),
      updateItem: vi.fn().mockResolvedValue({}),
      deleteItem: vi.fn().mockResolvedValue({}),
      getScopedUserId: vi.fn().mockImplementation((userId, scope) => {
        const workspaceId = typeof scope === 'string' ? scope : scope?.workspaceId;
        return `WS#${workspaceId}#${userId}`;
      }),
    };
    notificationManager = new NotificationManager(mockMemoryProvider);
  });

  describe('createNotification', () => {
    it('should create a notification and emit an event', async () => {
      const params = {
        type: NotificationType.SHARE_MESSAGE,
        senderId: 'user_1',
        senderName: 'User 1',
        receiverId: 'user_2',
        workspaceId: 'ws_1',
        content: 'Check this out',
        resourceId: 'msg_1',
        resourceType: ResourceType.MESSAGE,
      };

      await notificationManager.createNotification(params);

      // Verify putItem was called with correct structure
      expect(mockMemoryProvider.putItem).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'WS#ws_1#NOTIF#user_2',
          type: NotificationType.SHARE_MESSAGE,
          senderId: 'user_1',
          content: 'Check this out',
          status: NotificationStatus.UNREAD,
        })
      );

      // Verify event was emitted
      expect(emitEvent).toHaveBeenCalledWith(
        'notification.service',
        'notification.created',
        expect.objectContaining({
          senderId: 'user_1',
          receiverId: 'user_2',
        })
      );
    });
  });

  describe('listNotifications', () => {
    it('should query notifications for a user in a workspace', async () => {
      mockMemoryProvider.queryItemsPaginated.mockResolvedValue({
        items: [
          { id: 'notif_1', status: NotificationStatus.UNREAD, timestamp: 1000 },
          { id: 'notif_2', status: NotificationStatus.READ, timestamp: 2000 },
        ],
      });

      const results = await notificationManager.listNotifications('user_2', 'ws_1');

      expect(results).toHaveLength(2);
      expect(mockMemoryProvider.queryItemsPaginated).toHaveBeenCalledWith(
        expect.objectContaining({
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: expect.objectContaining({
            ':userId': 'WS#ws_1#NOTIF#user_2',
          }),
        })
      );
    });

    it('should filter by unread status if requested', async () => {
      mockMemoryProvider.queryItemsPaginated.mockResolvedValue({
        items: [{ id: 'notif_1', status: NotificationStatus.UNREAD, timestamp: 1000 }],
      });

      const results = await notificationManager.listNotifications('user_2', 'ws_1', {
        unreadOnly: true,
      });

      expect(results).toHaveLength(1);
      expect(mockMemoryProvider.queryItemsPaginated).toHaveBeenCalledWith(
        expect.objectContaining({
          FilterExpression: '#status = :unread',
          ExpressionAttributeValues: expect.objectContaining({
            ':unread': NotificationStatus.UNREAD,
          }),
        })
      );
    });
  });

  describe('markAsRead', () => {
    it('should update notification status to READ', async () => {
      await notificationManager.markAsRead('user_2', 'ws_1', 1000);

      expect(mockMemoryProvider.updateItem).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: {
            userId: 'WS#ws_1#NOTIF#user_2',
            timestamp: 1000,
          },
          UpdateExpression: 'SET #status = :read',
        })
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should update all unread notifications', async () => {
      mockMemoryProvider.queryItemsPaginated.mockResolvedValue({
        items: [
          { id: 'notif_1', timestamp: 1000 },
          { id: 'notif_2', timestamp: 2000 },
        ],
      });

      await notificationManager.markAllAsRead('user_2', 'ws_1');

      expect(mockMemoryProvider.updateItem).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteNotification', () => {
    it('should delete a specific notification', async () => {
      await notificationManager.deleteNotification('user_2', 'ws_1', 1000);

      expect(mockMemoryProvider.deleteItem).toHaveBeenCalledWith({
        userId: 'WS#ws_1#NOTIF#user_2',
        timestamp: 1000,
      });
    });
  });
});
