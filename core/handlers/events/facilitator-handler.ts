import { TASK_EVENT_SCHEMA } from '../../lib/schema/events';
import { AgentType } from '../../lib/types/index';
import { logger } from '../../lib/logger';
import { Context } from 'aws-lambda';
import { processEventWithAgent } from './shared';

export async function handleFacilitatorTask(
  eventDetail: Record<string, unknown>,
  context: Context
): Promise<void> {
  const { userId, task, traceId, sessionId, initiatorId, attachments } =
    TASK_EVENT_SCHEMA.parse(eventDetail);

  logger.info(`Handling facilitator task for user: ${userId}`, {
    traceId,
    sessionId,
  });

  await processEventWithAgent(userId, AgentType.FACILITATOR, task, {
    context,
    traceId,
    sessionId,
    initiatorId,
    attachments,
    handlerTitle: 'FACILITATOR_TASK',
    outboundHandlerName: 'facilitator-handler',
  });
}
