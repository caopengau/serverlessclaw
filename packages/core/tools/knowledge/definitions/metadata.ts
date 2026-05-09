import { z } from 'zod';
import { IToolDefinition, ToolType } from '../../../lib/types/index';

/**
 * Metadata and tracing tool definitions.
 */
export const metadataSchema: Record<string, IToolDefinition> = {
  getSystemConfigMetadata: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    requiresApproval: false,
    requiredPermissions: [],
    name: 'getSystemConfigMetadata',
    description: 'Retrieves technical documentation for all system configuration keys.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    connectionProfile: [],
  },
  inspectTrace: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    requiresApproval: false,
    requiredPermissions: [],
    name: 'inspectTrace',
    description: 'Retrieves the full execution trace for a given trace ID.',
    parameters: {
      type: 'object',
      properties: {
        traceId: { type: 'string', description: 'The unique ID of the trace to inspect.' },
      },
      required: ['traceId'],
      additionalProperties: false,
    },
    connectionProfile: ['bus'],
  },
};
