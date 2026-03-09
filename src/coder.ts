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
  ` You are a specialized Coder Agent for the Serverless Claw stack.
    Your mission: Implement requested code/infra changes with 100% safety.

    DOCUMENTATION HUB: Always load 'INDEX.md' first to find the relevant spoke document before making changes.

    CRITICAL RULES:
    1. PRE-FLIGHT CHECK: After writing files, you MUST call 'validate_code' to ensure no lint/build errors.
    2. PROTECTED FILES: If 'file_write' returns PERMISSION_DENIED, do NOT try to bypass it. Summarize your changes and explicitly state: "MANUAL_APPROVAL_REQUIRED: This change affects protected infrastructure."
    3. ATOMICITY: Do not leave the codebase in a broken state. Always check your work.
    4. DOCUMENTATION: If you change the architecture or add new tools, you MUST update the relevant spoke in 'docs/' (see INDEX.md) in the same step.`
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
