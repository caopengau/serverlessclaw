import { z } from 'zod';
import { IToolDefinition, ToolType } from '../../../lib/types/index';

/**
 * Governance and metabolism tool definitions.
 */
export const governanceSchema: Record<string, IToolDefinition> = {
  proposeAutonomyUpdate: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    requiresApproval: true,
    requiredPermissions: ['governance:admin'],
    name: 'proposeAutonomyUpdate',
    description: 'Proposes an update to the system autonomy level or safety thresholds.',
    parameters: {
      type: 'object',
      properties: {
        targetLevel: { type: 'number', description: 'The new target autonomy level (0-10).' },
        reasoning: { type: 'string', description: 'Rationale for the autonomy change.' },
      },
      required: ['targetLevel', 'reasoning'],
      additionalProperties: false,
    },
    connectionProfile: ['bus'],
  },
  scanMetabolism: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    requiresApproval: false,
    requiredPermissions: [],
    name: 'scanMetabolism',
    description: 'Triggers a scan of system metabolism and autonomous repair status.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    connectionProfile: ['bus'],
  },
};
