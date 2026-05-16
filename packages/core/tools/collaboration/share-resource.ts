import { ITool, ToolType, createToolResult } from '../../lib/types/tool';
import { getNotificationManager } from '../../lib/services/notification-manager';
import { NotificationType, ResourceType } from '../../lib/types/notification';
import { logger } from '../../lib/logger';

/**
 * Tool for sharing messages or assets with colleagues.
 */
export const shareResourceTool: ITool = {
  name: 'share_resource',
  description:
    'Share a particular message or asset with a colleague in the workspace. Use this to notify humans about findings, assets, or important context.',
  type: ToolType.FUNCTION,
  connectionProfile: ['memory', 'notification'],
  parameters: {
    type: 'object',
    properties: {
      receiverId: {
        type: 'string',
        description: 'The ID of the colleague to share the resource with.',
      },
      receiverName: {
        type: 'string',
        description: 'The name of the colleague (for display purposes).',
      },
      resourceId: {
        type: 'string',
        description: 'The ID of the message or the URL/ID of the asset being shared.',
      },
      resourceType: {
        type: 'string',
        enum: ['message', 'asset'],
        description: 'Whether the shared resource is a message or an asset.',
      },
      content: {
        type: 'string',
        description: 'A brief note or description explaining why this is being shared.',
      },
      workspaceId: {
        type: 'string',
        description: 'The workspace ID where the sharing is occurring.',
      },
    },
    required: ['receiverId', 'resourceId', 'resourceType', 'content', 'workspaceId'],
  },
  execute: async (args: Record<string, unknown>) => {
    const { receiverId, receiverName, resourceId, resourceType, content, workspaceId } = args as {
      receiverId: string;
      receiverName?: string;
      resourceId: string;
      resourceType: ResourceType;
      content: string;
      workspaceId: string;
    };

    try {
      const notificationManager = getNotificationManager();

      // For now, assume the sender is the current agent (SYSTEM)
      // In a real execution, we might want to pass the actual agentId/name from the context
      const senderId = 'SYSTEM';
      const senderName = 'AI Agent';

      await notificationManager.createNotification({
        type:
          resourceType === ResourceType.MESSAGE
            ? NotificationType.SHARE_MESSAGE
            : NotificationType.SHARE_ASSET,
        senderId,
        senderName,
        receiverId,
        workspaceId,
        resourceId,
        resourceType,
        content,
      });

      return createToolResult(
        `Successfully shared the ${resourceType} with ${receiverName || receiverId}.`
      );
    } catch (error) {
      logger.error('Failed to execute share_resource tool:', error);
      return createToolResult(
        `Failed to share resource: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
};
