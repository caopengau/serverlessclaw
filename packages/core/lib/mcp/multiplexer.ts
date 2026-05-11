import { ITool } from '../types/tool';
import { MCPBridge } from './mcp-bridge';
import { logger } from '../logger';
import { AgentRegistry } from '../registry';
import { DYNAMO_KEYS } from '../constants/system';

/**
 * MCPMultiplexer provides a high-level interface for managing multiple MCP sources.
 * It acts as a registry and router for external capabilities, allowing agents
 * to discover and interact with diverse resource types through a single gateway.
 */
export class MCPMultiplexer {
  private static registeredServers: Set<string> = new Set();

  /**
   * Discovers and aggregates tools from all active MCP sources.
   *
   * @param options - Configuration for tool discovery.
   * @returns A unified array of tools available for agent consumption.
   */
  static async resolveTools(
    options: {
      requestedTools?: string[];
      workspaceId?: string;
      skipConnection?: boolean;
    } = {}
  ): Promise<ITool[]> {
    const { workspaceId, requestedTools, skipConnection = false } = options;

    logger.info(`[MCPMultiplexer] Resolving tools for workspace: ${workspaceId || 'global'}`);

    try {
      // 1. Fetch external tools via MCPBridge
      // This includes local, remote, and managed servers configured in DynamoDB
      const mcpTools = await MCPBridge.getExternalTools(
        requestedTools,
        skipConnection,
        workspaceId
      );

      // 2. Track registered servers for metrics/health
      const serverNames = new Set(mcpTools.map((t) => t.name.split('_')[0]));
      serverNames.forEach((name) => this.registeredServers.add(name));

      logger.info(
        `[MCPMultiplexer] Successfully resolved ${mcpTools.length} tools from ${serverNames.size} MCP servers.`
      );

      return mcpTools;
    } catch (error) {
      logger.error(`[MCPMultiplexer] Tool resolution failed:`, error);
      return [];
    }
  }

  /**
   * Returns health status for all known MCP servers.
   */
  static async getHealthStatus(
    workspaceId?: string
  ): Promise<Record<string, 'online' | 'offline' | 'unknown'>> {
    const serversConfig = (await AgentRegistry.getRawConfig(DYNAMO_KEYS.MCP_SERVERS, {
      workspaceId,
    })) as Record<string, unknown>;
    const status: Record<string, 'online' | 'offline' | 'unknown'> = {};

    if (!serversConfig) return {};

    for (const name of Object.keys(serversConfig)) {
      // Logic for actual health checks could be added here
      status[name] = 'unknown';
    }

    return status;
  }

  /**
   * Discovers and loads tools from configured MCP servers.
   * @deprecated Use resolveTools() for the unified interface.
   */
  static async getExternalTools(
    requestedTools?: string[],
    skipConnection: boolean = false,
    workspaceId?: string
  ): Promise<ITool[]> {
    return MCPBridge.getExternalTools(requestedTools, skipConnection, workspaceId);
  }

  /**
   * Retrieves tool definitions from all cached MCP server results.
   */
  static async getCachedTools(workspaceId: string = 'global'): Promise<Partial<ITool>[]> {
    return MCPBridge.getCachedTools(workspaceId);
  }

  /**
   * Registers a new MCP server configuration at runtime.
   * This is used by plugins to dynamically add capabilities.
   */
  static async registerServer(
    name: string,
    config: Record<string, unknown> | string,
    workspaceId?: string
  ): Promise<void> {
    const { ConfigManager } = await import('../registry/config');

    // Principle 13: Atomic registration of new MCP servers
    await ConfigManager.atomicUpdateMapEntity(
      DYNAMO_KEYS.MCP_SERVERS,
      name,
      typeof config === 'string' ? { url: config, type: 'remote' } : config,
      { workspaceId }
    );

    logger.info(
      `[MCPMultiplexer] Registered new MCP server: ${name} (WS: ${workspaceId || 'global'})`
    );
  }
}
