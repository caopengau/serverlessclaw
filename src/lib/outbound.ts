import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { Resource } from 'sst';
import { EventType, MessageRole } from './types';
import { DynamoMemory } from './memory';

const eventbridge = new EventBridgeClient({});
const memory = new DynamoMemory();

export async function sendOutboundMessage(
  source: string,
  userId: string,
  message: string,
  saveContext: boolean = false
) {
  try {
    if (saveContext) {
      // Save to user context so the Main Agent knows what the sub-agent said
      await memory.addMessage(userId, { role: MessageRole.ASSISTANT, content: message });
    }

    await eventbridge.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: source,
            DetailType: EventType.OUTBOUND_MESSAGE,
            Detail: JSON.stringify({ userId, message }),
            EventBusName: (Resource as any).AgentBus.name,
          },
        ],
      })
    );
  } catch (e) {
    console.error(`Failed to send outbound message from ${source}:`, e);
  }
}
