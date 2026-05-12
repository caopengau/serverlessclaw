import { logger } from '../../lib/logger';
import { reportHealthIssue } from '../../lib/lifecycle/health';
import { EventType } from '../../lib/types/agent';

/**
 * Handles explicit DLQ_ROUTE events, which are generated when the Events Lambda
 * encounters an unhandled or failing event type.
 *
 * @param detail - The extracted event payload.
 * @param eventType - The type of event (DLQ_ROUTE).
 */
export async function handleDlqRoute(
  detail: Record<string, unknown>,
  _eventType: string
): Promise<void> {
  const originalEvent = detail.originalEvent as Record<string, unknown>;
  const detailType = detail.detailType as string;
  const envelopeId = detail.envelopeId as string;
  const errorMessage = detail.errorMessage as string;
  const workspaceId =
    (detail.workspaceId as string) || (originalEvent.workspaceId as string) || undefined;
  const teamId = (detail.teamId as string) || (originalEvent.teamId as string) || undefined;
  const staffId = (detail.staffId as string) || (originalEvent.staffId as string) || undefined;

  const userId = (detail.userId as string) || (originalEvent.userId as string) || 'SYSTEM';
  const traceId = (detail.traceId as string) || (originalEvent.traceId as string) || 'unknown';

  logger.error(`[DLQ_ROUTE] Received unhandled or failed event: ${detailType}`, {
    envelopeId,
    errorMessage,
    workspaceId,
    traceId,
    originalEvent: JSON.stringify(originalEvent).substring(0, 500), // Log preview
  });

  // Prevent SYSTEM_HEALTH_REPORT -> DLQ_ROUTE -> SYSTEM_HEALTH_REPORT feedback loops.
  if (
    detailType === EventType.SYSTEM_HEALTH_REPORT &&
    typeof errorMessage === 'string' &&
    errorMessage.includes('Recursion limit exceeded')
  ) {
    logger.warn(
      `[DLQ_ROUTE] Suppressing health re-report for recursion-rerouted ${detailType} (trace: ${traceId})`
    );
    return;
  }

  // Report the issue so it shows up in dashboards
  await reportHealthIssue({
    component: 'EventHandler',
    issue: `Routed event to DLQ: ${detailType} - ${errorMessage || 'Unhandled event type'}`,
    severity: 'high',
    userId,
    traceId,
    workspaceId,
    context: {
      envelopeId,
      originalEvent,
      routeReason: errorMessage,
      teamId,
      staffId,
    },
  });

  // Here, one could potentially store the payload in a DynamoDB DLQ table or
  // send it to an SQS DLQ for manual inspection/replay. For now, we rely on
  // the EventBridge DLQ and Health Issues dashboard.
}
