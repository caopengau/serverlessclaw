import { IToolDefinition } from '../../lib/types/index';

/**
 * Agent management tool definitions.
 */
export const agentTools: Record<string, IToolDefinition> = {
  dispatchTask: {
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
  createAgent: {
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
          enum: ['openai', 'bedrock', 'openrouter', 'minimax'],
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
  discoverPeers: {
    name: 'discoverPeers',
    description:
      'Discovers available peer agents in the swarm for dynamic topology construction. ' +
      'Returns agents filtered by capability, category, or status.',
    parameters: {
      type: 'object',
      properties: {
        capability: {
          type: 'string',
          description:
            'Optional filter: capability or tool name to match (e.g., "coder", "deploy").',
        },
        category: {
          type: 'string',
          enum: ['social', 'system'],
          description: 'Optional filter: agent category.',
        },
        topologyType: {
          type: 'string',
          enum: ['mesh', 'hierarchy', 'pipeline'],
          description: 'The desired topology type for the discovered peers.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    connectionProfile: ['config'],
  },
  registerPeer: {
    name: 'registerPeer',
    description:
      'Registers a peer connection in the swarm topology. Creates or updates a bidirectional ' +
      'link between two agents for dynamic coordination.',
    parameters: {
      type: 'object',
      properties: {
        sourceAgentId: {
          type: 'string',
          description: 'The agent initiating the peer connection.',
        },
        targetAgentId: {
          type: 'string',
          description: 'The agent to connect to.',
        },
        topologyType: {
          type: 'string',
          enum: ['mesh', 'hierarchy', 'pipeline'],
          description: 'The topology relationship type.',
        },
        label: {
          type: 'string',
          description: 'Optional label for the connection (e.g., "delegates to", "reviews").',
        },
      },
      required: ['sourceAgentId', 'targetAgentId', 'topologyType'],
      additionalProperties: false,
    },
    connectionProfile: ['config'],
  },
};
