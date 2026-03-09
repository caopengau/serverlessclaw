import { DynamoMemory } from './memory';
import { Agent } from './agent';
import { OpenAIProvider } from './provider';
import { tools } from './tools';

const memory = new DynamoMemory();
const provider = new OpenAIProvider();
// The Coder Agent might have a different set of tools (e.g., FileWriteTool)
const agent = new Agent(
  memory,
  provider,
  Object.values(tools),
  'You are a specialized Coder Agent. Your job is to implement code and infrastructure changes requested by the Manager Agent. You write high-quality, safe code.'
);

export const handler = async (event: any) => {
  console.log('Coder Agent received task:', JSON.stringify(event, null, 2));

  const { userId, task } = event;

  if (!userId || !task) {
    console.error('Invalid event payload');
    return;
  }

  // 1. Process the task
  // Since this is a sub-agent, it might not need a lock or might use a sub-lock
  const response = await agent.process(userId, `CODER TASK: ${task}`);

  console.log('Coder Agent completed task:', response);

  // 2. Future: Emit completion event back to the bus
  return response;
};
