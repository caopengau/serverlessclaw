import { logger } from '../lib/logger';
import { reportHealthIssue } from '../lib/lifecycle/health';

/**
 * Route an unhandled or failed event to the Dead Letter Queue for retry.
 */
export async function routeToDlq(
  event: { 'detail-type': string; detail: Record<string, unknown>; id?: string },
  detailType: string,
  userId: string,
  traceId: string,
  errorMessage?: string
): Promise<void> {
  const { emitEvent } = await import('../lib/utils/bus');
  const { EventType } = await import('../lib/types/agent');
  try {
    await emitEvent('events.handler', EventType.DLQ_ROUTE, {
      eventCategory: 'dlq_routing',
      detailType,
      originalEvent: event.detail,
      envelopeId: event.id,
      userId,
      traceId,
      errorMessage,
      retryCount: (event.detail.retryCount as number) ?? 0,
      timestamp: Date.now(),
      observability: {
        detailType,
        envelopeId: event.id,
        userId,
        traceId,
        errorMessage,
        retryCount: (event.detail.retryCount as number) ?? 0,
        timestamp: Date.now(),
      },
    });
    logger.info(`[EVENTS] Event ${detailType} routed to DLQ for retry`, {
      detailType,
      timestamp: Date.now(),
    });
  } catch (dlqError) {
    // DLQ routing failed - report health issue but don't block
    logger.error(`[EVENTS] Failed to route to DLQ:`, dlqError);
    await reportHealthIssue({
      component: 'EventHandler',
      issue: `Failed to route unhandled event to DLQ: ${detailType}`,
      severity: 'high',
      userId,
      traceId,
      context: { detailType, dlqError: String(dlqError) },
    });
    throw new Error(`Unhandled event type: ${detailType}`);
  }
}
