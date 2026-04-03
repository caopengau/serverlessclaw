import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../logger';
import { BaseMemoryProvider } from '../memory/base';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const lambdaClient = new LambdaClient({});

export interface WarmupConfig {
  servers: Record<string, string>; // serverName -> ARN
  agents: Record<string, string>; // agentName -> ARN
  ttlSeconds: number; // How long warm state is valid
}

export interface WarmupState {
  server: string;
  lastWarmed: string; // ISO timestamp
  warmedBy: 'webhook' | 'scheduler' | 'recovery';
  ttl: number; // Unix timestamp for expiration
  latencyMs?: number;
  coldStart?: boolean;
}

export interface WarmupEvent {
  type: 'WARMUP';
  source: string;
  userChatId?: string;
  intent?: string;
}

/**
 * Smart Warmup Manager
 * Tracks warm state and provides intent-based warmup instead of rigid scheduling.
 */
export class WarmupManager extends BaseMemoryProvider {
  private readonly config: WarmupConfig;

  private get ttlSeconds(): number {
    return this.config.ttlSeconds ?? 900; // Default 15 minutes
  }

  constructor(config: WarmupConfig, docClient?: DynamoDBDocumentClient) {
    super(docClient);
    this.config = config;
  }

  /**
   * Check if a server is currently warm (has recent warm state).
   */
  async isServerWarm(serverName: string): Promise<boolean> {
    try {
      const item = await this.getWarmState(serverName);
      if (!item) return false;

      const now = Math.floor(Date.now() / 1000);
      return item.ttl > now;
    } catch (error) {
      logger.warn(`[WARMUP] Failed to check warm state for ${serverName}:`, error);
      return false;
    }
  }

  /**
   * Get warm state for a server from DynamoDB.
   */
  async getWarmState(serverName: string): Promise<WarmupState | null> {
    try {
      const items = await this.queryItemsPaginated({
        TableName: this.tableName,
        KeyConditionExpression: 'pk = :pk AND sk = :sk',
        ExpressionAttributeValues: {
          ':pk': `WARM#${serverName}`,
          ':sk': 'STATE',
        },
      });
      return items.items.length > 0 ? (items.items[0] as unknown as WarmupState) : null;
    } catch (error) {
      logger.warn(`[WARMUP] Failed to get warm state for ${serverName}:`, error);
      return null;
    }
  }

  /**
   * Record warm state after successful warmup.
   */
  async recordWarmState(state: WarmupState): Promise<void> {
    try {
      await this.putItem({
        pk: `WARM#${state.server}`,
        sk: 'STATE',
        ...state,
      });
      logger.info(`[WARMUP] Recorded warm state for ${state.server}`);
    } catch (error) {
      logger.error(`[WARMUP] Failed to record warm state for ${state.server}:`, error);
      throw error;
    }
  }

  /**
   * Warm a specific MCP server and record state.
   */
  async warmMcpServer(
    serverName: string,
    warmedBy: 'webhook' | 'scheduler' | 'recovery' = 'webhook'
  ): Promise<WarmupState> {
    const arn = this.config.servers[serverName];
    if (!arn) {
      throw new Error(`MCP server ${serverName} not found in config`);
    }

    const startTime = Date.now();

    try {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'warmup',
            version: '1.0.0',
          },
        },
      };

      await lambdaClient.send(
        new InvokeCommand({
          FunctionName: arn,
          InvocationType: 'RequestResponse',
          Payload: JSON.stringify({
            httpMethod: 'POST',
            path: '/mcp',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(jsonRpcRequest),
          }),
        })
      );

      const latencyMs = Date.now() - startTime;

      // Check if this was likely a cold start (latency > 2 seconds)
      const coldStart = latencyMs > 2000;

      const state: WarmupState = {
        server: serverName,
        lastWarmed: new Date().toISOString(),
        warmedBy,
        ttl: Math.floor(Date.now() / 1000) + this.ttlSeconds,
        latencyMs,
        coldStart,
      };

      await this.recordWarmState(state);
      return state;
    } catch (error) {
      logger.error(`[WARMUP] Failed to warm MCP server ${serverName}:`, error);
      throw error;
    }
  }

  /**
   * Warm a specific agent Lambda and record state.
   */
  async warmAgent(
    agentName: string,
    warmedBy: 'webhook' | 'scheduler' | 'recovery' = 'webhook'
  ): Promise<WarmupState> {
    const arn = this.config.agents[agentName];
    if (!arn) {
      throw new Error(`Agent ${agentName} not found in config`);
    }

    const startTime = Date.now();

    try {
      await lambdaClient.send(
        new InvokeCommand({
          FunctionName: arn,
          InvocationType: 'Event', // Async fire-and-forget
          Payload: JSON.stringify({ type: 'WARMUP', source: 'warmup-manager' }),
        })
      );

      const latencyMs = Date.now() - startTime;

      const state: WarmupState = {
        server: agentName,
        lastWarmed: new Date().toISOString(),
        warmedBy,
        ttl: Math.floor(Date.now() / 1000) + this.ttlSeconds,
        latencyMs,
        coldStart: false, // Can't detect cold start with async invocation
      };

      await this.recordWarmState(state);
      return state;
    } catch (error) {
      logger.error(`[WARMUP] Failed to warm agent ${agentName}:`, error);
      throw error;
    }
  }

  /**
   * Smart warmup: only warm servers/agents that are cold based on intent.
   * Returns list of actually warmed servers (skips warm ones).
   */
  async smartWarmup(options: {
    servers?: string[];
    agents?: string[];
    intent?: string;
    warmedBy?: 'webhook' | 'scheduler' | 'recovery';
  }): Promise<{ servers: string[]; agents: string[] }> {
    const warmedServers: string[] = [];
    const warmedAgents: string[] = [];

    // Warm MCP servers
    if (options.servers) {
      for (const server of options.servers) {
        const isWarm = await this.isServerWarm(server);
        if (!isWarm) {
          try {
            await this.warmMcpServer(server, options.warmedBy || 'webhook');
            warmedServers.push(server);
          } catch (error) {
            logger.warn(`[WARMUP] Failed to warm server ${server}:`, error);
          }
        } else {
          logger.info(`[WARMUP] Server ${server} already warm, skipping`);
        }
      }
    }

    // Warm agents
    if (options.agents) {
      for (const agent of options.agents) {
        const isWarm = await this.isServerWarm(agent);
        if (!isWarm) {
          try {
            await this.warmAgent(agent, options.warmedBy || 'webhook');
            warmedAgents.push(agent);
          } catch (error) {
            logger.warn(`[WARMUP] Failed to warm agent ${agent}:`, error);
          }
        } else {
          logger.info(`[WARMUP] Agent ${agent} already warm, skipping`);
        }
      }
    }

    return { servers: warmedServers, agents: warmedAgents };
  }

  /**
   * Get all currently warm servers/agents.
   */
  async getWarmServers(): Promise<WarmupState[]> {
    try {
      const items = await this.queryItemsPaginated({
        TableName: this.tableName,
        KeyConditionExpression: 'begins_with(pk, :prefix) AND sk = :sk',
        ExpressionAttributeValues: {
          ':prefix': 'WARM#',
          ':sk': 'STATE',
        },
      });

      const now = Math.floor(Date.now() / 1000);
      return items.items
        .map((item) => item as unknown as WarmupState)
        .filter((state) => state.ttl > now);
    } catch (error) {
      logger.error('[WARMUP] Failed to get warm servers:', error);
      return [];
    }
  }

  /**
   * Clean up expired warm states.
   */
  async cleanupExpiredStates(): Promise<number> {
    try {
      const items = await this.queryItemsPaginated({
        TableName: this.tableName,
        KeyConditionExpression: 'begins_with(pk, :prefix) AND sk = :sk',
        ExpressionAttributeValues: {
          ':prefix': 'WARM#',
          ':sk': 'STATE',
        },
      });

      const now = Math.floor(Date.now() / 1000);
      let deleted = 0;

      for (const item of items.items) {
        const state = item as unknown as WarmupState;
        if (state.ttl <= now) {
          await this.docClient.send(
            new DeleteCommand({
              TableName: this.tableName,
              Key: {
                pk: `WARM#${state.server}`,
                sk: 'STATE',
              },
            })
          );
          deleted++;
        }
      }

      logger.info(`[WARMUP] Cleaned up ${deleted} expired warm states`);
      return deleted;
    } catch (error) {
      logger.error('[WARMUP] Failed to cleanup expired states:', error);
      return 0;
    }
  }
}
