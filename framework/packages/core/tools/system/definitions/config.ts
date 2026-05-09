import { z } from 'zod';
import { IToolDefinition, ToolType } from '../../../lib/types/index';
import { LLMProvider } from '../../../lib/types/llm';

export const configSchema: Record<string, IToolDefinition> = {
  switchModel: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    connectionProfile: [],
    connector_id: '',
    auth: { type: 'api_key', resource_id: '' },
    requiresApproval: true,
    requiredPermissions: ['admin'],
    name: 'switchModel',
    description: 'Switch the active LLM provider and model at runtime.',
    parameters: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          enum: [
            LLMProvider.OPENAI,
            LLMProvider.BEDROCK,
            LLMProvider.OPENROUTER,
            LLMProvider.MINIMAX,
          ],
        },
        model: { type: 'string' },
      },
      required: ['provider', 'model'],
      additionalProperties: false,
    },
  },
  setSystemConfig: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    connectionProfile: [],
    connector_id: '',
    auth: { type: 'api_key', resource_id: '' },
    requiresApproval: true,
    requiredPermissions: ['admin'],
    name: 'setSystemConfig',
    description:
      'Updates a global system configuration in DynamoDB (e.g., UI theme, model settings).',
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'The unique configuration key (e.g., "ui_theme", "active_model").',
        },
        value: { type: 'object', description: 'The new value for the configuration.' },
        description: { type: 'string', description: 'Reason for the change for audit logging.' },
      },
      required: ['key', 'value'],
      additionalProperties: false,
    },
  },
  getSystemConfig: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    connectionProfile: [],
    connector_id: '',
    auth: { type: 'api_key', resource_id: '' },
    requiresApproval: false,
    requiredPermissions: [],
    name: 'getSystemConfig',
    description: 'Retrieves a global system configuration value from DynamoDB.',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'The unique configuration key to retrieve.' },
      },
      required: ['key'],
      additionalProperties: false,
    },
  },
  listSystemConfigs: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    connectionProfile: [],
    connector_id: '',
    auth: { type: 'api_key', resource_id: '' },
    requiresApproval: false,
    requiredPermissions: [],
    name: 'listSystemConfigs',
    description: 'Lists all available configuration keys and their current values (use sparingly).',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  proposeAutonomyUpdate: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    connectionProfile: ['config', 'bus'],
    connector_id: '',
    auth: { type: 'api_key', resource_id: '' },
    requiresApproval: false,
    requiredPermissions: [],
    name: 'proposeAutonomyUpdate',
    description:
      'Proposes an update to the agents autonomy mode (AUTO vs HITL) based on trust scores and performance metrics.',
    parameters: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'The ID of the agent to update.' },
        targetMode: {
          type: 'string',
          enum: ['AUTO', 'HITL'],
          description: 'The target autonomy mode.',
        },
        reason: { type: 'string', description: 'Justification for the proposal.' },
        trustScore: {
          type: 'number',
          description: 'Current cognitive health trust score (0-100).',
        },
      },
      required: ['agentId', 'targetMode', 'reason'],
      additionalProperties: false,
    },
  },
  scanMetabolism: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    connectionProfile: ['config', 'bus'],
    connector_id: '',
    auth: { type: 'api_key', resource_id: '' },
    requiresApproval: false,
    requiredPermissions: [],
    name: 'scanMetabolism',
    description:
      'Performs a deep-scan for metabolic health and regenerative repair (Silo 7 (Metabolism)), generating prune proposals for unused tools and redundant files.',
    parameters: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description:
            'Optional specific agent ID to scan for tool bloat. If not provided, performs a global system scan.',
        },
      },
      additionalProperties: false,
    },
  },
  promoteCapability: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    connectionProfile: ['config', 'bus'],
    connector_id: '',
    auth: { type: 'api_key', resource_id: '' },
    requiresApproval: true,
    requiredPermissions: ['admin'],
    name: 'promoteCapability',
    description:
      'Autonomous release management: Graduates a new tool/agent from PENDING (HITL) to PROMOTED (AUTO) state after successful verification. Requires high agent trust.',
    parameters: {
      type: 'object',
      properties: {
        targetAgentId: {
          type: 'string',
          description: 'The ID of the agent whose capability is being promoted.',
        },
        toolName: { type: 'string', description: 'The name of the tool to activate/promote.' },
        reason: {
          type: 'string',
          description: 'Justification for promotion based on successful test/usage data.',
        },
      },
      required: ['targetAgentId', 'toolName', 'reason'],
      additionalProperties: false,
    },
  },
};
