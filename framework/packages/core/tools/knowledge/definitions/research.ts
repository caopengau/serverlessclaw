import { z } from 'zod';
import { IToolDefinition, ToolType } from '../../../lib/types/index';

/**
 * Research-related tool definitions.
 */
export const researchSchema: Record<string, IToolDefinition> = {
  requestResearch: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    requiresApproval: false,
    requiredPermissions: [],
    name: 'requestResearch',
    description: 'Dispatches a technical research mission to the Researcher Agent.',
    parameters: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'The research goal or question.' },
        parallel: {
          type: 'boolean',
          description: 'Whether to allow parallel exploration of sub-topics.',
        },
      },
      required: ['goal'],
      additionalProperties: false,
    },
    connectionProfile: ['bus'],
  },
  technicalResearch: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    requiresApproval: false,
    requiredPermissions: [],
    name: 'technicalResearch',
    description: 'Dispatches a technical research mission to a specific agent.',
    parameters: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'The research goal or question.' },
        agentId: { type: 'string', description: 'The ID of the agent to perform research.' },
        parallel: {
          type: 'boolean',
          description: 'Whether to allow parallel exploration.',
        },
      },
      required: ['goal'],
      additionalProperties: false,
    },
    connectionProfile: ['bus'],
  },
};
