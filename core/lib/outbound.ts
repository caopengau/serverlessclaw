import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { Resource } from 'sst';
import { SSTResource } from './types/index';
import { EventType } from './types/index';
import { logger } from './logger';

const eventbridge = new EventBridgeClient({});
const typedResource = Resource as unknown as SSTResource;

export async function sendOutboundMessage(
  source: string,
  userId: string,
  message: string,
  memoryContexts?: string[]
) {
  try {
    await eventbridge.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: source,
            DetailType: EventType.OUTBOUND_MESSAGE,
            Detail: JSON.stringify({ userId, message, memoryContexts }),
            EventBusName: typedResource.AgentBus.name,
          },
        ],
      })
    );
  } catch (e) {
    logger.error(`Failed to send outbound message from ${source}:`, e);
  }
}
