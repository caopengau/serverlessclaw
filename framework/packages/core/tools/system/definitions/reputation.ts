import { z } from 'zod';
import { IToolDefinition, ToolType } from '../../../lib/types/index';

/**
 * Reputation management tool definitions.
 */
export const reputationSchema: Record<string, IToolDefinition> = {
  getAgentReputation: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    requiresApproval: false,
    requiredPermissions: [],
    name: 'getAgentReputation',
    description: 'Retrieves current reputation metrics for a specific agent.',
    parameters: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'The ID of the agent to look up.' },
      },
      required: ['agentId'],
      additionalProperties: false,
    },
    connectionProfile: ['bus'],
  },
  resetReputation: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    requiresApproval: true,
    requiredPermissions: ['governance:admin'],
    name: 'resetReputation',
    description: 'Resets the reputation score and history for a specific agent.',
    parameters: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'The ID of the agent to reset.' },
      },
      required: ['agentId'],
      additionalProperties: false,
    },
    connectionProfile: ['bus'],
  },
};
