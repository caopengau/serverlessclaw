import { ITool, MCPServerConfig } from './types/index';
import { logger } from './logger';
import { AgentRegistry } from './registry';
import { MCPClientManager } from './mcp/client-manager';
import { MCPToolMapper } from './mcp/tool-mapper';

/**
 * MCPBridge coordinates connections to external Model Context Protocol servers.
 * It provides a unified interface for agents to discover and execute external tools
 * while maintaining a modular architecture for scalability and AI readiness.
 */
export class MCPBridge {
  /**
   * Connects to an MCP server and returns its tools.
   * Handles hub priority and local fallbacks.
   */
  static async getToolsFromServer(
    serverName: string,
    connectionString: string,
    env?: Record<string, string>,
    forceLocal: boolean = false
  ): Promise<ITool[]> {
    const hubUrl = process.env.MCP_HUB_URL;
    const isLocalCommand = !connectionString.startsWith('http');

    if (hubUrl && isLocalCommand && !forceLocal) {
      try {
        const hubServerUrl = `${hubUrl.replace(/\/$/, '')}/${serverName}`;
        logger.info(`Attempting Hub connection for ${serverName}: ${hubServerUrl}`);
        const tools = await this.getToolsFromServer(serverName, hubServerUrl, env, false);
        if (tools.length > 0) return tools;
      } catch {
        logger.warn(`Hub connection failed for ${serverName}, switching to local.`);
      }
    }

    try {
      const client = await MCPClientManager.connect(serverName, connectionString, env);
      const response = await client.listTools();
      return MCPToolMapper.mapTools(serverName, client, response.tools);
    } catch (e: unknown) {
      logger.error(`Failed to fetch tools from ${serverName}:`, e);
      MCPClientManager.deleteClient(serverName);
      return [];
    }
  }

  /**
   * Discovers and loads tools from configured MCP servers.
   */
  static async getExternalTools(requestedTools?: string[]): Promise<ITool[]> {
    const serversConfig = (await AgentRegistry.getRawConfig('mcp_servers')) as Record<
      string,
      string | MCPServerConfig
    >;

    const allTools: ITool[] = [];
    const defaultServers: Record<string, MCPServerConfig> = {
      filesystem: { command: 'npx -y @modelcontextprotocol/server-filesystem .' },
      git: { command: 'npx -y @cyanheads/git-mcp-server' },
      'google-search': { command: 'npx -y @mcp-server/google-search-mcp' },
      puppeteer: { command: 'npx -y @kirkdeam/puppeteer-mcp-server' },
      fetch: { command: 'npx -y mcp-fetch-server' },
      aws: { command: 'npx -y mcp-aws-devops-server' },
      'aws-s3': { command: 'npx -y @geunoh/s3-mcp-server' },
    };

    const finalConfig = serversConfig ?? {};
    let configUpdated = false;

    for (const [name, defaultConfig] of Object.entries(defaultServers)) {
      if (!finalConfig[name]) {
        finalConfig[name] = defaultConfig;
        configUpdated = true;
      }
    }

    if (configUpdated) {
      await AgentRegistry.saveRawConfig('mcp_servers', finalConfig);
    }

    for (const [name, config] of Object.entries(finalConfig)) {
      const needsThisServer =
        !requestedTools || requestedTools.some((t) => t === name || t.startsWith(`${name}_`));
      if (!needsThisServer) continue;

      if (typeof config === 'object' && config.type === 'managed') {
        allTools.push({
          name: config.name ?? name,
          description: config.description ?? `Managed tool for ${name}`,
          parameters: config.parameters ?? { type: 'object', properties: {} },
          connector_id: config.connector_id,
          type: 'mcp',
          execute: async () => `Managed tool (${name}) executed autonomously by provider.`,
        });
        continue;
      }

      let connectionString: string;
      let env: Record<string, string> | undefined;

      if (typeof config === 'string') connectionString = config;
      else if (config.type === 'remote') connectionString = config.url;
      else if (config.type === 'local' || !config.type) {
        connectionString = config.command;
        env = config.env;
      } else continue;

      const serverTools = await this.getToolsFromServer(name, connectionString, env);
      allTools.push(...serverTools);
    }

    return allTools;
  }

  /**
   * Retrieves tool definitions from cache.
   */
  static async getCachedTools(): Promise<Partial<ITool>[]> {
    const cached = await AgentRegistry.getRawConfig('mcp_tools_cache');
    return Array.isArray(cached) ? cached : [];
  }

  /**
   * Closes all active MCP connections.
   */
  static async closeAll(): Promise<void> {
    await MCPClientManager.closeAll();
  }
}
