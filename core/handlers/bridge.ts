import { IoTDataPlaneClient, PublishCommand } from '@aws-sdk/client-iot-data-plane';

const iot = new IoTDataPlaneClient({});

/**
 * Bridges AgentBus (EventBridge) to RealtimeBus (IoT Core).
 * This allows the dashboard to receive background updates in real-time.
 */
export const handler = async (event: any) => {
  console.log('[RealtimeBridge] Received event:', event['detail-type']);

  const userId = event.detail.userId || 'dashboard-user';
  const sessionId = event.detail.sessionId;

  // If we have a sessionId, we can target the specific chat session
  // Otherwise fallback to the generic user signal topic
  const topic = sessionId
    ? `users/${userId}/sessions/${sessionId}/signal`
    : `users/${userId}/signal`;

  try {
    // AWS IoT requires payload to be a Uint8Array or string
    const command = new PublishCommand({
      topic,
      payload: Buffer.from(JSON.stringify(event.detail)),
      qos: 1,
    });

    await iot.send(command);
    console.log(`[RealtimeBridge] Published to ${topic}`);
  } catch (error) {
    console.error('[RealtimeBridge] Failed to publish:', error);
  }
};
