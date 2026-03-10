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
     Your goal is to analyze conversations and extract insights.

     1. EXTRACT FACTS: Identify permanent user details for long-term memory.
     2. IDENTIFY GAPS: Analyze if the agent's response was lacking or if the system is missing a capability.
     3. CLASSIFY GAPS:
        - TACTICAL: A lesson learned about the user's preference or a better way to phrase things.
        - STRATEGIC: A missing tool, sub-agent, or architectural feature.

     RETURN FORMAT:
     FACTS: <updated list of facts>
     TACTICAL_GAP: <lesson learned or 'NONE'>
     STRATEGIC_GAP: <missing capability or 'NONE'>`
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
    const factsMatch = response.match(/FACTS:\s*([\s\S]*?)(?=TACTICAL_GAP:|$)/);
    const tacticalMatch = response.match(/TACTICAL_GAP:\s*([\s\S]*?)(?=STRATEGIC_GAP:|$)/);
    const strategicMatch = response.match(/STRATEGIC_GAP:\s*([\s\S]*)/);

    let updatedFacts = factsMatch ? factsMatch[1].trim() : existingFacts;

    // Handle Tactical Gap (Lesson Learned)
    if (tacticalMatch && tacticalMatch[1].trim() && !tacticalMatch[1].includes('NONE')) {
      const lesson = tacticalMatch[1].trim();
      updatedFacts = `${updatedFacts}\n\n[LESSON_LEARNED]: ${lesson}`;
      console.log('Tactical Gap Added to Memory:', lesson);
    }

    if (updatedFacts !== existingFacts) {
      await memory.updateDistilledMemory(userId, updatedFacts);
    }

    // Handle Strategic Gap (Evolution Required)
    if (strategicMatch && strategicMatch[1].trim() && !strategicMatch[1].includes('NONE')) {
      const gapDescription = strategicMatch[1].trim();
      const gapId = Date.now().toString();
      await memory.setGap(gapId, gapDescription);
      console.log('Strategic Gap Identified by Reflector:', gapDescription);

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
