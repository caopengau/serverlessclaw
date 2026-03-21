import { toolDefinitions } from './definitions/index';
import { AgentRegistry } from '../lib/registry';

/**
 * Retrieves the current MCP servers configuration.
 */
export const GET_MCP_CONFIG = {
  ...toolDefinitions.getMcpConfig,
  execute: async (): Promise<string> => {
    const config = await AgentRegistry.getRawConfig('mcp_servers');
    return JSON.stringify(config ?? {}, null, 2);
  },
};
