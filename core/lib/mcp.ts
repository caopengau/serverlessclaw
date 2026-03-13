import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { ITool } from './types/tool';
import { logger } from './logger';
import { AgentRegistry } from './registry';

/**
 * MCPBridge allows ServerlessClaw to connect to external Model Context Protocol servers.
 * It dynamically discovers tools from these servers and makes them available to agents.
 */
export class MCPBridge {
  private static clients: Map<string, Client> = new Map();

  /**
   * Connects to an MCP server (Local or Remote) and returns its tools.
   */
  static async getToolsFromServer(serverName: string, connectionString: string): Promise<ITool[]> {
    try {
      let client = this.clients.get(serverName);

      if (!client) {
        let transport;

        if (connectionString.startsWith('http')) {
          logger.info(`Connecting to Remote MCP Server: ${serverName} (${connectionString})`);
          transport = new SSEClientTransport(new URL(connectionString));
        } else {
          const parts = connectionString.split(' ');
          const command = parts[0];
          const args = parts.slice(1);
          logger.info(`Spawning Local MCP Server: ${serverName} (${command} ${args.join(' ')})`);
          transport = new StdioClientTransport({ command, args });
        }

        client = new Client(
          { name: 'ServerlessClaw-Client', version: '1.0.0' },
          { capabilities: {} }
        );
        await client.connect(transport);
        this.clients.set(serverName, client);
      }

      const response = await client.listTools();
      return response.tools.map((mcpTool) => ({
        name: `${serverName}_${mcpTool.name}`,
        description: mcpTool.description || `Tool from ${serverName} server.`,
        parameters: mcpTool.inputSchema as any,
        execute: async (toolArgs: Record<string, unknown>) => {
          const result = await client!.callTool({
            name: mcpTool.name,
            arguments: toolArgs,
          });
          return JSON.stringify(result.content);
        },
      }));
    } catch (e) {
      logger.error(`Failed to fetch tools from MCP server ${serverName}:`, e);
      return [];
    }
  }

  /**
   * Discovers and loads all tools from all configured MCP servers.
   */
  static async getAllExternalTools(): Promise<ITool[]> {
    const serversConfig =
      ((await AgentRegistry.getRawConfig('mcp_servers')) as Record<string, string>) || {};
    const allTools: ITool[] = [];

    for (const [name, connectionString] of Object.entries(serversConfig)) {
      const serverTools = await this.getToolsFromServer(name, connectionString);
      allTools.push(...serverTools);
    }

    return allTools;
  }

  /**
   * Cleanup connections.
   */
  static async closeAll(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.close();
    }
    this.clients.clear();
  }
}
