import { DynamoMemory } from '../lib/memory';
import { Agent } from '../lib/agent';
import { ProviderManager } from '../lib/providers';
import { ReasoningProfile, Message, EventType, SSTResource } from '../lib/types';
import { Resource } from 'sst';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

const typedResource = Resource as unknown as SSTResource;

const memory = new DynamoMemory();
const provider = new ProviderManager();
const eventbridge = new EventBridgeClient({});

export const handler = async (event: { userId: string; conversation: Message[] }) => {
  console.log('Reflector Agent received task:', JSON.stringify(event, null, 2));

  const { userId, conversation } = event;

  if (!userId || !conversation) {
    console.error('Invalid event payload');
    return;
  }

  // Reflector Agent is a specialized Agent instance
  const reflector = new Agent(
    memory,
    provider,
    [], // No tools needed for reflection
    `You are the specialized Reflector Agent for the Serverless Claw stack.
     Your goal is twofold:
     1. Extract key facts about the user to maintain long-term memory.
     2. Identify CAPABILITY GAPS: Did the agent fail to fulfill a request? Is a tool missing? Did a plan fail?

     RETURN FORMAT:
     FACTS: <updated list of facts>
     GAP: <description of identified gap, or 'NONE' if no gap found>`
  );

  const existingFacts = await memory.getDistilledMemory(userId);

  const reflectionPrompt = `
    EXISTING FACTS:
    ${existingFacts || 'None'}

    CONVERSATION:
    ${conversation.map((m) => `${m.role.toUpperCase()}: ${m.content || (m.tool_calls ? '[Tool Calls]' : '')}`).join('\n')}

    Update the EXISTING FACTS with any new information found in the CONVERSATION.
    Identify any CAPABILITY GAPS.
  `;

  // Use 'fast' profile for cost-effective reflection
  const response = await reflector.process(
    `SYSTEM#REFLECTOR#${userId}`,
    reflectionPrompt,
    ReasoningProfile.FAST
  );

  if (response) {
    const factsMatch = response.match(/FACTS:\s*([\s\S]*?)(?=GAP:|$)/);
    const gapMatch = response.match(/GAP:\s*([\s\S]*)/);

    if (factsMatch && factsMatch[1].trim()) {
      await memory.updateDistilledMemory(userId, factsMatch[1].trim());
    }

    if (gapMatch && gapMatch[1].trim() && !gapMatch[1].includes('NONE')) {
      const gapDescription = gapMatch[1].trim();
      const gapId = Date.now().toString();
      await memory.setGap(gapId, gapDescription);
      console.log('Capability Gap Identified by Reflector:', gapDescription);

      // Notify Planner Agent via EventBridge
      try {
        await eventbridge.send(
          new PutEventsCommand({
            Entries: [
              {
                Source: 'reflector.agent',
                DetailType: EventType.EVOLUTION_PLAN,
                Detail: JSON.stringify({ gapId, details: gapDescription, contextUserId: userId }),
                EventBusName: typedResource.AgentBus.name,
              },
            ],
          })
        );
      } catch (e) {
        console.error('Failed to emit evolution plan event from Reflector:', e);
      }
    }
  }

  return response;
};
