import { z } from 'zod';
import { IToolDefinition, ToolType } from '../../../lib/types/index';

/**
 * MCP-related tool definitions.
 */
export const mcpSchema: Record<string, IToolDefinition> = {
  registerMCPServer: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    requiresApproval: false,
    requiredPermissions: ['config:update'],
    name: 'registerMCPServer',
    description: 'Registers a new MCP server in the global configuration.',
    parameters: {
      type: 'object',
      properties: {
        serverName: { type: 'string', description: 'Unique name for the MCP server.' },
        type: {
          type: 'string',
          enum: ['local', 'remote', 'managed'],
          description: 'Type of connection.',
        },
        command: { type: 'string', description: 'Command for local servers.' },
        url: { type: 'string', description: 'URL for remote servers.' },
        connector_id: { type: 'string', description: 'Connector ID for managed servers.' },
        env: { type: 'string', description: 'JSON string of environment variables.' },
      },
      required: ['serverName'],
      additionalProperties: false,
    },
    connectionProfile: ['config'],
  },
  unregisterMCPServer: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    requiresApproval: false,
    requiredPermissions: ['config:update'],
    name: 'unregisterMCPServer',
    description: 'Removes an MCP server from the configuration.',
    parameters: {
      type: 'object',
      properties: {
        serverName: { type: 'string', description: 'Name of the server to remove.' },
      },
      required: ['serverName'],
      additionalProperties: false,
    },
    connectionProfile: ['config'],
  },
  getMcpConfig: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    requiresApproval: false,
    requiredPermissions: [],
    name: 'getMcpConfig',
    description: 'Retrieves the current MCP servers configuration.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    connectionProfile: ['config'],
  },
};
