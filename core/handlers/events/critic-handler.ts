import { Context } from 'aws-lambda';
import { AgentEvent } from '../../lib/types/agent';

export const handleCriticTask = async (
  eventDetail: Record<string, unknown>,
  context: Context
): Promise<void> => {
  const { handler } = await import('../../agents/critic');
  const event = {
    detail: eventDetail as Record<string, unknown>,
    source: 'agent.critic',
  } as unknown as AgentEvent;

  await handler(event, context);
};
