import { realtime } from 'sst/aws/realtime';
import { Resource } from 'sst';

/**
 * Bridges AgentBus (EventBridge) to RealtimeBus (IoT Core).
 * This allows the dashboard to receive background updates in real-time.
 */
export const handler = async (event: any) => {
  console.log('[RealtimeBridge] Received event:', event['detail-type']);

  const userId = event.detail.userId || 'dashboard-user';
  const topic = `users/${userId}/signal`;

  try {
    await (realtime as any).publish((Resource as any).RealtimeBus, {
      topic,
      payload: event.detail,
    });
    console.log(`[RealtimeBridge] Published to ${topic}`);
  } catch (error) {
    console.error('[RealtimeBridge] Failed to publish:', error);
  }
};
