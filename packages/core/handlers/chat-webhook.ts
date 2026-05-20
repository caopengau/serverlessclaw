import { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { logger } from '../lib/logger';
import { emitEvent } from '../lib/utils/bus';
import { EventType, EventSource } from '../lib/types/agent/events';
import { bootstrap } from '../lib/bootstrap';

/**
 * Generic ChatOps Webhook Handler.
 * Ingests incoming messages from various chat platforms (Slack, Discord, custom API),
 * normalizes them, and publishes a CHAT_MESSAGE_RECEIVED event to the AgentBus.
 */
export const handler = async (
  event: APIGatewayProxyEventV2,
  _context: Context
): Promise<APIGatewayProxyResultV2> => {
  await bootstrap();
  logger.info('[CHAT_WEBHOOK] Start | Event:', event.body?.substring(0, 100));

  try {
    const body = event.body ? JSON.parse(event.body) : {};

    // Very basic parsing for this prototype/stub.
    // In a real system, you'd use InputAdapters like in webhook.ts
    const platform = event.headers['x-platform'] || 'api';
    const userId = body.userId || 'unknown-user';
    const sessionId = body.sessionId || body.channelId || 'default-session';
    const text = body.text || body.message || '';

    if (!text) {
      return { statusCode: 200, body: 'No text provided' };
    }

    const payload = {
      userId,
      sessionId,
      platform,
      text,
      attachments: [],
      workspaceId: body.workspaceId,
      teamId: body.teamId,
      staffId: body.staffId,
      metadata: body.metadata || {},
    };

    logger.info(
      `[CHAT_WEBHOOK] Emitting CHAT_MESSAGE_RECEIVED for user: ${userId}, session: ${sessionId}`
    );

    await emitEvent(EventSource.WEBHOOK, EventType.CHAT_MESSAGE_RECEIVED, payload);

    return { statusCode: 200, body: 'Accepted' };
  } catch (err: unknown) {
    logger.error('[CHAT_WEBHOOK] Error processing webhook:', err);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};
