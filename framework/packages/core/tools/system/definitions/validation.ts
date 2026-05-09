import { z } from 'zod';
import { IToolDefinition, ToolType } from '../../../lib/types/index';

export const validationSchema: Record<string, IToolDefinition> = {
  validateCode: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    connectionProfile: [],
    connector_id: '',
    auth: { type: 'api_key', resource_id: '' },
    requiresApproval: false,
    requiredPermissions: [],
    name: 'validateCode',
    description: 'Runs type checking and linting in the current or specified directory.',
    parameters: {
      type: 'object',
      properties: {
        dir_path: {
          type: 'string',
          description: 'Optional path to the directory to validate. Defaults to project root.',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  verifyChanges: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    connectionProfile: [],
    connector_id: '',
    auth: { type: 'api_key', resource_id: '' },
    requiresApproval: false,
    requiredPermissions: [],
    name: 'verifyChanges',
    description:
      'Runs the full project verification suite including type checks, linting, and unit tests. MUST pass before committing to main.',
    parameters: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          description: 'Optional scope for testing (e.g., package name or directory).',
        },
        fast: {
          type: 'boolean',
          description: 'If true, skips slower integration tests.',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
};
