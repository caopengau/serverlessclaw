import { ITool, ToolType } from '../types/tool';
import { MCPServerConfig } from '../types/mcp';
import { logger } from '../logger';
import { AgentRegistry } from '../registry';
import { MCPClientManager } from './client-manager';
import { MCPToolMapper } from './tool-mapper';
import { LockManager } from '../lock/lock-manager';
import { MCP } from '../constants/tools';
import { DYNAMO_KEYS } from '../constants/system';
import { DEFAULT_MCP_SERVERS } from './mcp-defaults';

/**
 * MCPBridge coordinates connections to external Model Context Protocol (MCP) servers.
 * It provides a "Unified Multiplexer" interface for agents to discover and execute external tools
 * while maintaining a modular architecture for scalability and AI readiness.
 * Supports hub-priority routing and local command-based execution.
 *
 * Renamed from MCPMultiplexer to align with Unified Architecture docs.
 */
export class MCPBridge {
  private static discovering: Map<string, Promise<ITool[]>> = new Map();
  private static lastFailures: Map<string, number> = new Map();
  private static readonly FAILURE_BACKOFF_MS = MCP.FAILURE_BACKOFF_MS;

  /**
   * Connects to an MCP server and returns its tools.
   * Handles hub priority, remote URLs, and local fallbacks.
   */
  static async getToolsFromServer(
    serverName: string,
    connectionString: string,
    env?: Record<string, string>,
    options?: { skipHubRouting?: boolean; isRecursive?: boolean }
  ): Promise<ITool[]> {
    const cacheKey = `mcp_tools_cache_${serverName}`;

    // 0. Check for recent failures (Discovery Backoff)
    const lastFailure = this.lastFailures.get(cacheKey);
    if (lastFailure && Date.now() - lastFailure < this.FAILURE_BACKOFF_MS) {
      logger.info(
        `[MCPBridge] Discovery recently failed for ${serverName}, skipping until backoff expires.`
      );
      return [];
    }

    // 1. Check in-memory discovery map first (Thundering Herd Protection)
    if (!options?.isRecursive) {
      const existingDiscovery = this.discovering.get(cacheKey);
      if (existingDiscovery) {
        logger.info(`[MCPBridge] Discovery already in progress for ${serverName}, awaiting...`);
        return await existingDiscovery;
      }
    }

    const discoveryPromise = (async () => {
      let acquired = false;
      let lockManager: LockManager | null = null;
      let lockId = '';
      let ownerId = '';

      if (!options?.isRecursive) {
        // 1. Check Distributed Lock
        lockManager = new LockManager();
        lockId = `mcp_discovery_lock_${serverName}`;
        ownerId =
          process.env.AWS_LAMBDA_LOG_STREAM_NAME ||
          `node_${process.pid}_${Math.random().toString(36).substring(7)}`;

        const hubUrl = process.env.MCP_HUB_URL;
        const isLocalCommand = !connectionString.startsWith('http');

        if (hubUrl && isLocalCommand && !options?.skipHubRouting) {
          try {
            const hubServerUrl = `${hubUrl.replace(/\/$/, '')}/${serverName}`;
            logger.info(`[MCPBridge] Attempting Hub connection for ${serverName}: ${hubServerUrl}`);
            const tools = await this.getToolsFromServer(serverName, hubServerUrl, env, {
              skipHubRouting: true,
              isRecursive: true,
            });
            if (tools.length > 0) return tools;
          } catch {
            logger.warn(`[MCPBridge] Hub connection failed for ${serverName}, switching to local.`);
          }
        }
      }

      const cacheTTL = parseInt(process.env.MCP_CACHE_TTL_MS ?? String(MCP.DEFAULT_CACHE_TTL_MS));

      const checkCache = async () => {
        const cached = (await AgentRegistry.getRawConfig(cacheKey)) as {
          tools: any[];
          timestamp: number;
        } | null;
        if (cached && Date.now() - cached.timestamp < cacheTTL) {
          logger.info(`[MCPBridge] Using cached tool definitions for MCP server ${serverName}`);
          // Load overrides
          const overrides = (await AgentRegistry.getRawConfig(
            DYNAMO_KEYS.TOOL_METADATA_OVERRIDES
          )) as Record<string, Partial<ITool>> | undefined;

          return MCPToolMapper.mapCachedTools(
            serverName,
            cached.tools,
            async () => await MCPClientManager.connect(serverName, connectionString, env),
            overrides
          );
        }
        return null;
      };

      const cachedResult = await checkCache();
      if (cachedResult) return cachedResult;

      if (!options?.isRecursive && lockManager) {
        for (let i = 0; i < 3; i++) {
          acquired = await lockManager.acquire(lockId, { ttlSeconds: 60, ownerId });
          if (acquired) break;

          logger.info(
            `[MCPBridge] Discovery lock for ${serverName} held by another node, waiting...`
          );
          await new Promise((r) => setTimeout(r, 2000));

          const retryCached = await checkCache();
          if (retryCached) return retryCached;
        }

        if (!acquired) {
          const errorMsg = `[MCPBridge] Failed to acquire discovery lock for ${serverName}. Aborting.`;
          logger.error(errorMsg);
          throw new Error(errorMsg);
        }
      }

      try {
        const client = await MCPClientManager.connect(serverName, connectionString, env);
        const response = await client.listTools();

        // Load overrides
        const overrides = (await AgentRegistry.getRawConfig(
          DYNAMO_KEYS.TOOL_METADATA_OVERRIDES
        )) as Record<string, Partial<ITool>> | undefined;

        // Update cache
        await AgentRegistry.saveRawConfig(cacheKey, {
          tools: response.tools,
          timestamp: Date.now(),
        });

        return MCPToolMapper.mapTools(serverName, client, response.tools, overrides);
      } catch (e: unknown) {
        logger.warn(`[MCPBridge] Failed to fetch tools from ${serverName}:`, e);
        this.lastFailures.set(cacheKey, Date.now());
        MCPClientManager.deleteClient(serverName);
        await AgentRegistry.saveRawConfig(cacheKey, null).catch(() => {});
        return [];
      } finally {
        if (acquired) {
          await lockManager!.release(lockId, ownerId).catch((err: unknown) => {
            logger.warn(`[MCPBridge] Failed to release discovery lock for ${serverName}:`, err);
          });
        }
      }
    })();

    if (!options?.isRecursive) {
      this.discovering.set(cacheKey, discoveryPromise);
    }

    try {
      return await discoveryPromise;
    } finally {
      if (!options?.isRecursive) {
        this.discovering.delete(cacheKey);
      }
    }
  }

  /**
   * Discovers and loads tools from configured MCP servers.
   */
  static async getExternalTools(
    requestedTools?: string[],
    skipConnection: boolean = false
  ): Promise<ITool[]> {
    const serversConfig = (await AgentRegistry.getRawConfig('mcp_servers')) as Record<
      string,
      string | MCPServerConfig
    >;

    const allTools: ITool[] = [];
    const finalConfig = serversConfig ?? {};
    let configUpdated = false;

    // Determine base path for filesystem
    const defaultFsPath = process.env.AWS_LAMBDA_FUNCTION_NAME
      ? (process.env.MCP_FILESYSTEM_PATH ?? (process.env.LAMBDA_TASK_ROOT || '/var/task'))
      : '.';

    // Use environment variables to override default servers with Lambda multiplexer ARNs
    let serverArns: Record<string, string> = {};
    try {
      if (process.env.MCP_SERVER_ARNS) {
        serverArns = JSON.parse(process.env.MCP_SERVER_ARNS);
      }
    } catch (e) {
      logger.warn('[MCPBridge] Failed to parse MCP_SERVER_ARNS, using empty config:', e);
    }

    const defaultServers = DEFAULT_MCP_SERVERS;

    for (const [name, defaultConfig] of Object.entries(defaultServers)) {
      if (!finalConfig[name]) {
        if (serverArns[name]) {
          logger.info(
            `[MCPBridge] Configuring default MCP server ${name} as remote Lambda via MCP_SERVER_ARNS`
          );
          finalConfig[name] = { type: 'remote', url: serverArns[name] };
        } else if (name === 'filesystem') {
          finalConfig[name] = {
            type: 'local',
            command: `npx -y @modelcontextprotocol/server-filesystem ${defaultFsPath}`,
          };
        } else {
          finalConfig[name] = defaultConfig;
        }
        configUpdated = true;
      }
    }

    if (configUpdated) {
      await AgentRegistry.saveRawConfig('mcp_servers', finalConfig);
    }

    const neededConfigs = Object.entries(finalConfig).filter(([name]) => {
      if (!requestedTools || requestedTools.length === 0) return true;
      return requestedTools.some(
        (t) => t === name || t.startsWith(`${name}_`) || t.startsWith(`${name}:`)
      );
    });

    const serverPromises = neededConfigs.map(async ([name, config]) => {
      if (typeof config === 'object' && config.type === 'managed') {
        return [
          {
            name: config.name ?? name,
            description: config.description ?? `Managed tool for ${name}`,
            parameters: config.parameters ?? { type: 'object' as const, properties: {} },
            connector_id: config.connector_id,
            type: ToolType.MCP,
            connectionProfile: [],
            requiresApproval: false,
            requiredPermissions: [],
            execute: async () => `Managed tool (${name}) executed autonomously by provider.`,
          },
        ];
      }

      if (skipConnection) {
        return [
          {
            name: `${name}`,
            description: `MCP server: ${name} (Connect to see tools)`,
            parameters: { type: 'object' as const, properties: {} },
            type: ToolType.MCP,
            connectionProfile: [],
            requiresApproval: false,
            requiredPermissions: [],
            execute: async () => `MCP server ${name} placeholder`,
          },
        ];
      }

      let connectionString: string;
      let env: Record<string, string> | undefined;

      if (typeof config === 'string') {
        connectionString = config;
      } else if (config.type === 'remote') {
        connectionString = config.url;
      } else if (config.type === 'local') {
        connectionString = config.command;
        env = config.env;
      } else {
        return [];
      }

      // Special handling for filesystem: Always attempt local execution if we're in a Lambda with a workspace
      if (name === 'filesystem' && !!process.env.AWS_LAMBDA_FUNCTION_NAME) {
        const fsPath = process.env.MCP_FILESYSTEM_PATH ?? '/tmp';
        logger.info(
          `[MCPBridge] Forcing local execution for 'filesystem' server to preserve workspace access (Path: ${fsPath}).`
        );
        connectionString = `npx -y @modelcontextprotocol/server-filesystem ${fsPath}`;
      }

      try {
        return await this.getToolsFromServer(name, connectionString, env);
      } catch (e) {
        logger.error(`Discovery failed for MCP server ${name}:`, e);
        return [];
      }
    });

    const results = await Promise.all(serverPromises);
    for (const serverTools of results) {
      allTools.push(...serverTools);
    }

    return allTools;
  }

  /**
   * Retrieves tool definitions from all cached MCP server results.
   */
  static async getCachedTools(): Promise<Partial<ITool>[]> {
    const serversConfig = (await AgentRegistry.getRawConfig('mcp_servers')) as Record<
      string,
      string | MCPServerConfig
    >;

    if (!serversConfig) return [];

    const allCached: Partial<ITool>[] = [];
    const serverNames = Object.keys(serversConfig);

    const overrides = (await AgentRegistry.getRawConfig(DYNAMO_KEYS.TOOL_METADATA_OVERRIDES)) as
      | Record<string, Partial<ITool>>
      | undefined;

    for (const name of serverNames) {
      const cacheKey = `mcp_tools_cache_${name}`;
      const cached = (await AgentRegistry.getRawConfig(cacheKey)) as {
        tools: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }>;
      } | null;
      if (cached?.tools && Array.isArray(cached.tools)) {
        const mapped = cached.tools.map((t) => {
          const toolName = `${name}_${t.name}`;
          const override = overrides?.[toolName] || overrides?.[t.name];

          return {
            name: toolName,
            description: t.description ?? `Cached tool from ${name} server.`,
            parameters: t.inputSchema ?? { type: 'object', properties: {} },
            type: ToolType.MCP,
            connectionProfile: [],
            requiresApproval: override?.requiresApproval ?? false,
            requiredPermissions: override?.requiredPermissions ?? [],
          };
        }) as unknown as Partial<ITool>[];
        allCached.push(...mapped);
      }
    }

    return allCached;
  }

  /**
   * Closes all active MCP connections.
   */
  static async closeAll(): Promise<void> {
    await MCPClientManager.closeAll();
  }
}
