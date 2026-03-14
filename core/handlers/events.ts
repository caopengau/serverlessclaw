import { EventType } from '../lib/types/index';
import { logger } from '../lib/logger';
import { Context } from 'aws-lambda';
import { handleBuildFailure, handleBuildSuccess } from './events/build-handler';
import { handleContinuationTask } from './events/continuation-handler';
import { handleHealthReport } from './events/health-handler';
import { handleTaskResult } from './events/task-result-handler';
import { handleClarificationRequest } from './events/clarification-handler';

/**
 * Main entry point for the Events Handler.
 * Routes different EventBridge event types to specialized handlers.
 *
 * @param event - The EventBridge event containing detail-type and detail.
 * @param context - The AWS Lambda context.
 * @returns A promise that resolves when the event has been processed.
 */
export const handler = async (
  event: {
    'detail-type': string;
    detail: Record<string, unknown>;
  },
  context: Context
): Promise<void> => {
  logger.info('EventHandler received event:', JSON.stringify(event, null, 2));

  const detailType = event['detail-type'];
  const eventDetail = event.detail;

  switch (detailType) {
    case EventType.SYSTEM_BUILD_FAILED:
      await handleBuildFailure(eventDetail, context);
      break;

    case EventType.SYSTEM_BUILD_SUCCESS:
      await handleBuildSuccess(eventDetail);
      break;

    case EventType.CONTINUATION_TASK:
      await handleContinuationTask(eventDetail, context);
      break;

    case EventType.SYSTEM_HEALTH_REPORT:
      await handleHealthReport(eventDetail, context);
      break;

    case EventType.TASK_COMPLETED:
    case EventType.TASK_FAILED:
      await handleTaskResult(eventDetail, detailType);
      break;

    case EventType.CLARIFICATION_REQUEST:
      await handleClarificationRequest(eventDetail);
      break;

    default:
      logger.warn(`Unhandled event type: ${detailType}`);
  }
};
