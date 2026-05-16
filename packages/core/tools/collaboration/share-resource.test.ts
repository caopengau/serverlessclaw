import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shareResourceTool } from './share-resource';
import { getNotificationManager } from '../../lib/services/notification-manager';

vi.mock('../../lib/services/notification-manager');
vi.mock('../../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe('share_resource tool', () => {
  let mockNotificationManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNotificationManager = {
      createNotification: vi.fn().mockResolvedValue({}),
    };
    vi.mocked(getNotificationManager).mockReturnValue(mockNotificationManager);
  });

  it('should call notificationManager.createNotification with correct parameters', async () => {
    const args = {
      receiverId: 'user_2',
      receiverName: 'Alice',
      resourceId: 'msg_1',
      resourceType: 'message',
      content: 'Important info',
      workspaceId: 'ws_1',
    };

    const result = (await shareResourceTool.execute(args)) as any;

    expect(mockNotificationManager.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        receiverId: 'user_2',
        senderId: 'SYSTEM',
        workspaceId: 'ws_1',
        content: 'Important info',
      })
    );
    expect(result.text).toContain('Successfully shared');
  });

  it('should handle errors gracefully', async () => {
    mockNotificationManager.createNotification.mockRejectedValue(new Error('DB Error'));

    const args = {
      receiverId: 'user_2',
      resourceId: 'msg_1',
      resourceType: 'message',
      content: 'Important info',
      workspaceId: 'ws_1',
    };

    const result = (await shareResourceTool.execute(args)) as any;

    expect(result.text).toContain('Failed to share resource');
    expect(result.text).toContain('DB Error');
  });
});
