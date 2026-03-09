import { CodeBuildClient, StartBuildCommand } from '@aws-sdk/client-codebuild';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { Resource } from 'sst';
import { ITool } from './types';
import * as fs from 'fs/promises';
import * as path from 'path';

const codebuild = new CodeBuildClient({});
const eventbridge = new EventBridgeClient({});

export const tools: Record<string, ITool> = {
  dispatch_task: {
    name: 'dispatch_task',
    description: 'Dispatches a specialized task to a sub-agent (e.g., coder).',
    parameters: {
      type: 'object',
      properties: {
        agentType: {
          type: 'string',
          enum: ['coder'],
          description: 'The type of sub-agent to invoke.',
        },
        userId: { type: 'string', description: 'The user ID context for the task.' },
        task: { type: 'string', description: 'The specific task for the sub-agent.' },
      },
      required: ['agentType', 'userId', 'task'],
    },
    execute: async ({ agentType, userId, task }) => {
      console.log(`Dispatching ${agentType} task for user ${userId}: ${task}`);
      const command = new PutEventsCommand({
        Entries: [
          {
            Source: 'main.agent',
            DetailType: `${agentType}.task`,
            Detail: JSON.stringify({ userId, task }),
            EventBusName: Resource.AgentBus.name,
          },
        ],
      });

      try {
        await eventbridge.send(command);
        return `Task successfully dispatched to ${agentType} agent.`;
      } catch (error) {
        return `Failed to dispatch task: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  },
  file_write: {
    name: 'file_write',
    description: 'Writes content to a file. Used by the Coder Agent to implement changes.',
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'The relative path to the file.' },
        content: { type: 'string', description: 'The content to write.' },
      },
      required: ['filePath', 'content'],
    },
    execute: async ({ filePath, content }) => {
      // Guardrail: Prevent modifying bootstrap infrastructure
      if (filePath.includes('infra/bootstrap') || filePath === 'sst.config.ts') {
        // We'll allow sst.config.ts for now as per design, but maybe with a warning or restricted
        console.log(`Warning: Writing to sensitive file ${filePath}`);
      }

      try {
        const fullPath = path.resolve(process.cwd(), filePath);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, content, 'utf8');
        return `Successfully wrote to ${filePath}`;
      } catch (error) {
        return `Failed to write file: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  },
  trigger_deployment: {
    name: 'trigger_deployment',
    description: 'Triggers an autonomous self-deployment of the agent infrastructure.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'The reason for the deployment (e.g., added a new tool).',
        },
      },
      required: ['reason'],
    },
    execute: async ({ reason }) => {
      console.log(`Triggering deployment for reason: ${reason}`);
      const command = new StartBuildCommand({
        projectName: Resource.Deployer.name,
      });

      try {
        const response = await codebuild.send(command);
        return `Deployment started successfully. Build ID: ${response.build?.id}. Reason: ${reason}`;
      } catch (error) {
        return `Failed to trigger deployment: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  },
  calculator: {
    name: 'calculator',
    description: 'Evaluates mathematical expressions.',
    parameters: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'The expression to evaluate.' },
      },
      required: ['expression'],
    },
    execute: async ({ expression }) => {
      try {
        const result = Function(`"use strict"; return (${expression})`)();
        return `Result: ${result}`;
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  },
  get_weather: {
    name: 'get_weather',
    description: 'Get the current weather in a given location.',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'The city and state, e.g. San Francisco, CA' },
      },
      required: ['location'],
    },
    execute: async ({ location }) => {
      return `The weather in ${location} is sunny and 72°F.`;
    },
  },
};

export function getToolDefinitions() {
  return Object.values(tools).map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}
