import { IToolDefinition } from '../../lib/types/index';

export const metadataTools: Record<string, IToolDefinition> = {
  getSystemConfigMetadata: {
    name: 'getSystemConfigMetadata',
    description:
      'Retrieves technical documentation, implications, and risks for all system configuration keys.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
};
