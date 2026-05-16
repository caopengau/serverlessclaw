import { publishToRealtime } from '../../lib/utils/realtime';
import { logger } from '../../lib/logger';

interface NotificationEventDetail {
  id: string;
  type: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  workspaceId: string;
  content: string;
  timestamp: number;
  [key: string]: unknown;
}

/**
 * Handles internal notification events by publishing them to the real-time MQTT bus.
 * This enables the dashboard to show real-time notifications to users.
 */
export async function handleNotificationCreated(event: NotificationEventDetail): Promise<void> {
  logger.info('[INTERNAL-NOTIFIER] Received notification event:', JSON.stringify(event, null, 2));

  const { workspaceId } = event;

  if (!workspaceId) {
    logger.error('[INTERNAL-NOTIFIER] Missing workspaceId in notification event');
    return;
  }

  // Broadcast to the workspace signal topic.
  // The Dashboard NotificationBell component listens to 'workspaces/{workspaceId}/signal'
  const topic = `workspaces/${workspaceId}/signal`;

  try {
    // We wrap the event in the standard RealtimeMessage format
    const payload = {
      'detail-type': 'notification.created',
      detail: event,
    };

    await publishToRealtime(topic, payload);
    logger.info(`[INTERNAL-NOTIFIER] Published notification ${event.id} to ${topic}`);
  } catch (error) {
    logger.error(`[INTERNAL-NOTIFIER] Failed to publish notification ${event.id} to MQTT:`, error);
  }
}
