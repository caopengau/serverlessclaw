import { ITool, ToolType } from '../types/tool';
import { MCPServerConfig } from '../types/mcp';
import { logger } from '../logger';
import { AgentRegistry } from '../registry';
import { DYNAMO_KEYS } from '../constants/system';
import { MCPClientManager } from './client-manager';
import { MCPToolMapper } from './tool-mapper';
import { LockManager } from '../lock/lock-manager';
import { MCP } from '../constants/tools';
import { DEFAULT_MCP_SERVERS, SERVER_RESOLVERS } from './mcp-defaults';
import { PluginManager } from '../plugin-manager';

interface EffectiveScope {
  workspaceId: string;
  isRecursive: boolean;
  skipHubRouting: boolean;
}

/**
 * MCPBridge coordinates connections to external Model Context Protocol (MCP) servers.
 * It provides a "Unified Multiplexer" interface for agents to discover and execute external tools
 * while maintaining a modular architecture for scalability and AI readiness.
 */
export class MCPBridge {
  private static discovering: Map<string, Promise<ITool[]>> = new Map();
  private static lastFailures: Map<string, number> = new Map();
  private static readonly FAILURE_BACKOFF_MS = MCP.FAILURE_BACKOFF_MS;

  private static getEffectiveScope(options?: {
    skipHubRouting?: boolean;
    isRecursive?: boolean;
    workspaceId?: string;
  }): EffectiveScope {
    return {
      workspaceId: options?.workspaceId || 'global',
      isRecursive: !!options?.isRecursive,
      skipHubRouting: !!options?.skipHubRouting,
    };
  }

  /**
   * Connects to an MCP server and returns its tools.
   */
  static async getToolsFromServer(
    serverName: string,
    connectionString: string,
    env?: Record<string, string>,
    options?: { skipHubRouting?: boolean; isRecursive?: boolean; workspaceId?: string }
  ): Promise<ITool[]> {
    const scope = this.getEffectiveScope(options);
    const scopePrefix = scope.workspaceId === 'global' ? '' : `WS#${scope.workspaceId}#`;
    const cacheKey = `${scopePrefix}mcp_tools_cache_${serverName}`;

    // 0. Check for recent failures (Discovery Backoff)
    const lastFailure = this.lastFailures.get(cacheKey);
    if (lastFailure && Date.now() - lastFailure < this.FAILURE_BACKOFF_MS) {
      logger.info(
        `[MCPBridge] Discovery recently failed for ${serverName} (WS: ${scope.workspaceId}), skipping until backoff expires.`
      );
      return [];
    }

    // 1. Check in-memory discovery map first (Thundering Herd Protection)
    if (!scope.isRecursive) {
      const existingDiscovery = this.discovering.get(cacheKey);
      if (existingDiscovery) {
        logger.info(
          `[MCPBridge] Discovery already in progress for ${serverName} (WS: ${scope.workspaceId}), awaiting...`
        );
        return await existingDiscovery;
      }
    }

    // 2. Start discovery and register immediately to prevent thundering herds
    const discoveryPromise = (async () => {
      // Body of discovery...
      // (I'll keep the logic the same but ensure it's wrapped correctly)
      return await this._doDiscovery(serverName, connectionString, env, options, cacheKey, scope);
    })();

    if (!scope.isRecursive) {
      this.discovering.set(cacheKey, discoveryPromise);
    }

    return await discoveryPromise;
  }

  private static async _doDiscovery(
    serverName: string,
    connectionString: string,
    env: Record<string, string> | undefined,
    options: { workspaceId?: string; skipHubRouting?: boolean; isRecursive?: boolean } | undefined,
    cacheKey: string,
    scope: EffectiveScope
  ): Promise<ITool[]> {
    let acquired = false;
    let lockManager: LockManager | null = null;
    let lockId = '';
    let ownerId = '';

    if (!scope.isRecursive) {
      lockManager = new LockManager();
      lockId = `mcp_discovery_lock_${serverName}_${scope.workspaceId}`;
      ownerId =
        process.env.AWS_LAMBDA_LOG_STREAM_NAME ||
        `node_${process.pid}_${Math.random().toString(36).substring(7)}`;

      const hubUrl = process.env.MCP_HUB_URL;
      const isLocalCommand = !connectionString.startsWith('http');

      if (hubUrl && isLocalCommand && !scope.skipHubRouting) {
        try {
          const hubUrlObj = new URL(hubUrl.replace(/\/$/, '') + `/${serverName}`);
          // Propagate workspaceId to Hub for multi-tenant routing
          if (scope.workspaceId !== 'global') {
            hubUrlObj.searchParams.set('workspaceId', scope.workspaceId);
          }
          const hubServerUrl = hubUrlObj.toString();

          logger.info(
            `[MCPBridge] Attempting Hub connection for ${serverName}: ${hubServerUrl} (WS: ${scope.workspaceId})`
          );
          const tools = await this.getToolsFromServer(serverName, hubServerUrl, env, {
            ...options,
            skipHubRouting: true,
            isRecursive: true,
          });
          if (tools.length > 0) return tools;
        } catch {
          logger.warn(
            `[MCPBridge] Hub connection failed for ${serverName} (WS: ${scope.workspaceId}), switching to local.`
          );
        }
      }
    }

    const cacheTTL = parseInt(process.env.MCP_CACHE_TTL_MS ?? String(MCP.DEFAULT_CACHE_TTL_MS));

    const checkCache = async () => {
      const cached = (await AgentRegistry.getRawConfig(cacheKey, {
        workspaceId: options?.workspaceId,
      })) as {
        tools: Record<string, unknown>[];
        timestamp: number;
      } | null;

      if (cached && Date.now() - cached.timestamp < cacheTTL) {
        logger.info(
          `[MCPBridge] Using cached tool definitions for MCP server ${serverName} (WS: ${scope.workspaceId})`
        );
        const overrides = (await AgentRegistry.getRawConfig(DYNAMO_KEYS.TOOL_METADATA_OVERRIDES, {
          workspaceId: options?.workspaceId,
        })) as Record<string, Partial<ITool>> | undefined;

        return MCPToolMapper.mapCachedTools(
          serverName,
          cached.tools,
          async () =>
            await MCPClientManager.connect(serverName, connectionString, env, options?.workspaceId),
          overrides
        );
      }
      return null;
    };

    const cachedResult = await checkCache();
    if (cachedResult) return cachedResult;

    if (!scope.isRecursive && lockManager) {
      for (let i = 0; i < 3; i++) {
        acquired = await lockManager.acquire(lockId, { ttlSeconds: 60, ownerId });
        if (acquired) break;

        logger.info(
          `[MCPBridge] Discovery lock for ${serverName} held by another node (WS: ${scope.workspaceId}), waiting...`
        );
        await new Promise((r) => setTimeout(r, 2000));

        const retryCached = await checkCache();
        if (retryCached) return retryCached;
      }

      if (!acquired) {
        const errorMsg = `[MCPBridge] Failed to acquire discovery lock for ${serverName} (WS: ${scope.workspaceId}). Aborting.`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
      }
    }

    try {
      const client = await MCPClientManager.connect(
        serverName,
        connectionString,
        env,
        options?.workspaceId
      );
      const response = await client.listTools();

      const overrides = (await AgentRegistry.getRawConfig(DYNAMO_KEYS.TOOL_METADATA_OVERRIDES, {
        workspaceId: options?.workspaceId,
      })) as Record<string, Partial<ITool>> | undefined;

      await AgentRegistry.saveRawConfig(
        cacheKey,
        { tools: response.tools, timestamp: Date.now() },
        { workspaceId: options?.workspaceId }
      );

      return MCPToolMapper.mapTools(serverName, client, response.tools, overrides);
    } catch (e: unknown) {
      logger.warn(
        `[MCPBridge] Failed to fetch tools from ${serverName} (WS: ${scope.workspaceId}):`,
        e
      );
      this.lastFailures.set(cacheKey, Date.now());
      // Principle 11: Prune failure map to prevent memory leaks
      if (this.lastFailures.size > 1000) {
        const oldestKey = this.lastFailures.keys().next().value;
        if (oldestKey) this.lastFailures.delete(oldestKey);
      }
      MCPClientManager.deleteClient(serverName, options?.workspaceId);
      await AgentRegistry.saveRawConfig(cacheKey, null, {
        workspaceId: options?.workspaceId,
      }).catch(() => {});
      return [];
    } finally {
      if (acquired && lockManager) {
        await lockManager.release(lockId, ownerId).catch((err: unknown) => {
          logger.warn(`[MCPBridge] Failed to release discovery lock for ${serverName}:`, err);
        });
      }
      if (!scope.isRecursive) {
        this.discovering.delete(cacheKey);
      }
    }
  }

  /**
   * Discovers and loads tools from configured MCP servers.
   */
  static async getExternalTools(
    requestedTools?: string[],
    skipConnection: boolean = false,
    workspaceId?: string
  ): Promise<ITool[]> {
    const serversConfig = (await AgentRegistry.getRawConfig(DYNAMO_KEYS.MCP_SERVERS, {
      workspaceId,
    })) as Record<string, string | MCPServerConfig>;

    const allTools: ITool[] = [];
    const finalConfig = serversConfig ?? {};
    const { ConfigManager } = await import('../registry/config');

    let serverArns: Record<string, string> = {};
    try {
      if (process.env.MCP_SERVER_ARNS) {
        serverArns = JSON.parse(process.env.MCP_SERVER_ARNS);
      }
    } catch (e) {
      logger.warn('[MCPBridge] Failed to parse MCP_SERVER_ARNS, using empty config:', e);
    }

    const defaultServers = { ...DEFAULT_MCP_SERVERS, ...PluginManager.getRegisteredMCPServers() };

    for (const [name, defaultConfig] of Object.entries(defaultServers)) {
      if (!finalConfig[name]) {
        let serverConfig: string | MCPServerConfig;
        if (serverArns[name]) {
          logger.info(
            `[MCPBridge] Configuring default MCP server ${name} as remote Lambda via MCP_SERVER_ARNS`
          );
          serverConfig = { type: 'remote', url: serverArns[name] };
        } else if (SERVER_RESOLVERS[name] && typeof defaultConfig !== 'string') {
          serverConfig = SERVER_RESOLVERS[name](defaultConfig, process.env);
        } else {
          serverConfig = defaultConfig;
        }

        // Principle 13: Atomic initialization of missing default servers
        try {
          await ConfigManager.atomicUpdateMapEntity(
            DYNAMO_KEYS.MCP_SERVERS,
            name,
            serverConfig as unknown as Record<string, unknown>,
            {
              workspaceId,
              conditionExpression: 'attribute_not_exists(#val.#id)',
            }
          );
          finalConfig[name] = serverConfig;
        } catch (e: unknown) {
          if (
            e instanceof Error &&
            (e.name === 'ConditionalCheckFailedException' || e.message.includes('ConditionalCheck'))
          ) {
            // Already initialized by another process, fetch it to be sure
            const freshConfig = await AgentRegistry.getRawConfig(DYNAMO_KEYS.MCP_SERVERS, {
              workspaceId,
            });
            if (freshConfig && (freshConfig as Record<string, string | MCPServerConfig>)[name]) {
              finalConfig[name] = (freshConfig as Record<string, string | MCPServerConfig>)[name];
            }
          }
        }
      }
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

      if (SERVER_RESOLVERS[name] && typeof config !== 'string') {
        config = SERVER_RESOLVERS[name](config, process.env);
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

      try {
        return await this.getToolsFromServer(name, connectionString, env, { workspaceId });
      } catch (e) {
        logger.error(`Discovery failed for MCP server ${name} (WS: ${workspaceId}):`, e);
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
  static async getCachedTools(workspaceId: string = 'global'): Promise<Partial<ITool>[]> {
    const serversConfig = (await AgentRegistry.getRawConfig(DYNAMO_KEYS.MCP_SERVERS, {
      workspaceId: workspaceId === 'global' ? undefined : workspaceId,
    })) as Record<string, string | MCPServerConfig>;

    if (!serversConfig) return [];

    const allCached: Partial<ITool>[] = [];
    const serverNames = Object.keys(serversConfig);
    const overrides = (await AgentRegistry.getRawConfig(DYNAMO_KEYS.TOOL_METADATA_OVERRIDES, {
      workspaceId: workspaceId === 'global' ? undefined : workspaceId,
    })) as Record<string, Partial<ITool>> | undefined;

    const scopePrefix = workspaceId === 'global' ? '' : `WS#${workspaceId}#`;

    for (const name of serverNames) {
      const cacheKey = `${scopePrefix}mcp_tools_cache_${name}`;
      const cached = (await AgentRegistry.getRawConfig(cacheKey, {
        workspaceId: workspaceId === 'global' ? undefined : workspaceId,
      })) as {
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
