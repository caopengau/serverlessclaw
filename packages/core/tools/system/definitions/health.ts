import { z } from 'zod';
import { IToolDefinition, ToolType } from '../../../lib/types/index';

export const healthSchema: Record<string, IToolDefinition> = {
  checkHealth: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    connectionProfile: [],
    connector_id: '',
    auth: { type: 'api_key', resource_id: '' },
    requiresApproval: false,
    requiredPermissions: [],
    name: 'checkHealth',
    description: 'Performs a comprehensive system-wide health and connectivity check.',
    parameters: {
      type: 'object',
      properties: {
        verbose: { type: 'boolean', description: 'Detailed results.' },
      },
      additionalProperties: false,
    },
  },
  runCognitiveHealthCheck: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    connectionProfile: [],
    connector_id: '',
    auth: { type: 'api_key', resource_id: '' },
    requiresApproval: false,
    requiredPermissions: [],
    name: 'runCognitiveHealthCheck',
    description:
      'Runs a deep cognitive health check on agents, analyzing reasoning quality, memory health, and detecting anomalies.',
    parameters: {
      type: 'object',
      properties: {
        agentIds: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional list of specific agent IDs to check. If not provided, checks all backbone agents.',
        },
        verbose: {
          type: 'boolean',
          description: 'Include detailed metrics and anomaly information.',
        },
      },
      additionalProperties: false,
    },
  },
  checkReputation: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    connectionProfile: [],
    connector_id: '',
    auth: { type: 'api_key', resource_id: '' },
    requiresApproval: false,
    requiredPermissions: [],
    name: 'checkReputation',
    description:
      "Retrieves an agent's rolling 7-day performance reputation metrics (success rate, latency, score).",
    parameters: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'The unique ID of the agent to check (e.g., coder, planner).',
        },
      },
      required: ['agentId'],
      additionalProperties: false,
    },
  },
  debugAgent: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    connectionProfile: [],
    connector_id: '',
    auth: { type: 'api_key', resource_id: '' },
    requiresApproval: false,
    requiredPermissions: [],
    name: 'debugAgent',
    description: 'Enables advanced debugging and logging for a specific agent.',
    parameters: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
        level: { type: 'string', enum: ['info', 'debug', 'trace'] },
      },
      required: ['agentId', 'level'],
      additionalProperties: false,
    },
  },
};
