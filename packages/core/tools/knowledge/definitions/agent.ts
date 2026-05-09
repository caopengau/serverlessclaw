import { z } from 'zod';
import { IToolDefinition, ToolType, LLMProvider } from '../../../lib/types/index';

export const agentSchema: Record<string, IToolDefinition> = {
  dispatchTask: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    requiresApproval: false,
    requiredPermissions: [],
    name: 'dispatchTask',
    description: 'Dispatches a specialized task to a sub-agent.',
    parameters: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description:
            'The unique ID of the agent to invoke (e.g., coder, planner, or a custom agent ID).',
        },
        task: { type: 'string', description: 'The specific task for the sub-agent.' },
        metadata: {
          type: 'object',
          description: 'Optional task metadata or signals.',
        },
      },
      required: ['agentId', 'task', 'metadata'],
      additionalProperties: false,
    },
    connectionProfile: ['bus'],
  },
  manageAgentTools: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    requiresApproval: false,
    requiredPermissions: [],
    name: 'manageAgentTools',
    description: 'Updates the active toolset for a specific agent.',
    parameters: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'The unique ID of the agent (e.g., main, coder).',
        },
        toolNames: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of tool names.',
        },
      },
      required: ['agentId', 'toolNames'],
      additionalProperties: false,
    },
    connectionProfile: ['bus'],
  },
  listAgents: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    requiresApproval: false,
    requiredPermissions: [],
    name: 'listAgents',
    description: 'Lists all available specialized agents in the system and their capabilities.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    connectionProfile: ['bus'],
  },
  pulseCheck: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    requiresApproval: false,
    requiredPermissions: [],
    name: 'pulseCheck',
    description:
      'Performs a deep cognitive health check by pinging another agent. Verifies EventBus connectivity.',
    parameters: {
      type: 'object',
      properties: {
        targetAgentId: { type: 'string', description: 'The ID of the agent to ping.' },
      },
      required: ['targetAgentId'],
      additionalProperties: false,
    },
    connectionProfile: ['bus'],
  },
  createAgent: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    requiresApproval: false,
    requiredPermissions: [],
    name: 'createAgent',
    description: 'Registers a new agent in the system. Cannot override backbone agents.',
    parameters: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'Unique identifier for the new agent (lowercase, hyphenated).',
        },
        name: { type: 'string', description: 'Display name for the agent.' },
        systemPrompt: {
          type: 'string',
          description: 'The system prompt defining the agent persona and behavior.',
        },
        provider: {
          type: 'string',
          enum: [
            LLMProvider.OPENAI,
            LLMProvider.BEDROCK,
            LLMProvider.OPENROUTER,
            LLMProvider.MINIMAX,
          ],
          description: 'LLM provider for this agent.',
        },
        model: { type: 'string', description: 'Model ID to use (e.g., gpt-5.4-mini).' },
        enabled: {
          type: 'boolean',
          description: 'Whether the agent is active immediately.',
        },
      },
      required: ['agentId', 'name', 'systemPrompt'],
      additionalProperties: false,
    },
    connectionProfile: ['config'],
  },
  deleteAgent: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    requiresApproval: false,
    requiredPermissions: [],
    name: 'deleteAgent',
    description:
      'Removes a non-backbone agent from the registry. Backbone agents cannot be deleted.',
    parameters: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'The ID of the agent to remove.',
        },
      },
      required: ['agentId'],
      additionalProperties: false,
    },
    connectionProfile: ['config'],
  },
  syncAgentRegistry: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    requiresApproval: false,
    requiredPermissions: [],
    name: 'syncAgentRegistry',
    description:
      'Synchronizes the agent registry by refreshing backbone configs and discovering topology.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    connectionProfile: ['config'],
  },
};
