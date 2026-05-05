/**
 * Shared Agent Helper Utilities
 */

import { logger } from '../logger';
import { AgentRole, AGENT_TYPES, TraceSource, ReasoningProfile } from '../types/index';
import {
  AGENT_ERRORS,
  AGENT_ERRORS_CN,
  AGENT_ERROR_PREFIXES,
  CONFIG_KEYS,
  LOCALE_INSTRUCTIONS,
} from '../constants';
import { AgentProcessOptions } from '../agent/options';
import { EVENT_SCHEMA_MAP } from '../schema/events';

import { normalizeBaseUserId } from './normalize';

/**
 * Extract the base userId by removing CONV# prefix if present.
 */
export function extractBaseUserId(userId: string): string {
  return normalizeBaseUserId(userId);
}

export function isE2ETest(): boolean {
  const lifecycle = process.env.npm_lifecycle_event || '';
  const isVitest =
    process.env.VITEST ||
    process.env.CLAW_TEST === 'true' ||
    process.env.CORE_TEST === 'true' ||
    process.env.NODE_ENV === 'test' ||
    (globalThis as any).__vitest_worker__ !== undefined ||
    process.argv.some((arg) => arg.includes('vitest')) ||
    lifecycle.includes('test') ||
    lifecycle.includes('check') ||
    (globalThis as any).__CLAW_TEST__ === true ||
    (globalThis as any).CLAW_TEST === true ||
    (globalThis as any).IS_CLAW_TEST === true ||
    new Error().stack?.includes('.test.ts');

  return !!(process.env.PLAYWRIGHT || process.env.CI || isVitest);
}

/**
 * Extract and normalize payload from EventBridge event.
 */
export function extractPayload<T extends object>(event: { detail?: T } | T): T {
  return (event as { detail?: T }).detail ?? (event as T);
}

export function isWarmupEvent(event: unknown): boolean {
  const payload = extractPayload(event as Record<string, unknown>) as Record<string, unknown>;
  return payload.type === 'WARMUP' || payload.intent === 'warmup';
}

/**
 * Handle a warmup event by pre-initializing the agent.
 */
export async function handleWarmup(event: unknown, agentId: string | AgentRole): Promise<boolean> {
  if (isWarmupEvent(event)) {
    const target = agentId === 'brain' ? 'all cognitive agents' : `agent ${agentId}`;
    logger.info(`[WARMUP] Warming ${target}...`);
    try {
      if (agentId === 'brain') {
        await Promise.all([
          initAgent(AGENT_TYPES.CODER),
          initAgent(AGENT_TYPES.RESEARCHER),
          initAgent(AGENT_TYPES.STRATEGIC_PLANNER),
        ]);
      } else {
        await initAgent(agentId as AgentRole);
      }
      logger.info(`[WARMUP] ${target} is now warm.`);
      return true;
    } catch (e) {
      logger.warn(`[WARMUP] Failed to warm ${target}:`, e);
      return true;
    }
  }
  return false;
}

/**
 * Detect if an agent response indicates an internal error.
 */
export function detectFailure(response: string): boolean {
  return (
    response === AGENT_ERRORS.PROCESS_FAILURE ||
    response === AGENT_ERRORS_CN.PROCESS_FAILURE ||
    response.startsWith(AGENT_ERROR_PREFIXES.EN) ||
    response.startsWith(AGENT_ERROR_PREFIXES.CN) ||
    response.startsWith('SYSTEM_ERROR') ||
    response.startsWith('FAILED') ||
    response.startsWith('I encountered an internal error')
  );
}

/**
 * Check if response indicates a paused task.
 */
export function isTaskPaused(response: string): boolean {
  return response.startsWith('TASK_PAUSED');
}

/**
 * Load and validate agent configuration from the registry.
 */
export async function loadAgentConfig(
  agentId: string | AgentRole,
  options?: { workspaceId?: string }
): Promise<import('../types/index').IAgentConfig> {
  const { AgentRegistry } = await import('../registry');
  const config = await AgentRegistry.getAgentConfig(agentId, options);

  if (!config) {
    throw new Error(
      `Agent configuration for '${agentId}' not found in Registry${options?.workspaceId ? ` for workspace ${options.workspaceId}` : ''}`
    );
  }

  if (!config.enabled) {
    throw new Error(`Agent '${agentId}' is disabled`);
  }

  if (process.env.MCP_SERVER_ARNS) {
    try {
      const mcpArns = JSON.parse(process.env.MCP_SERVER_ARNS);
      config.mcpServers = {
        ...config.mcpServers,
        ...mcpArns,
      };
    } catch (e) {
      logger.warn(`Failed to parse MCP_SERVER_ARNS for agent ${agentId}:`, e);
    }
  }

  return config;
}

/**
 * Create an Agent instance with tools and configuration.
 */
export async function createAgent(
  agentId: string,
  config: import('../types/index').IAgentConfig,
  memory: import('../types/index').IMemory,
  provider: import('../providers/index').ProviderManager,
  locale: string = 'en'
): Promise<import('../agent').Agent> {
  const [{ getAgentTools }, { Agent }] = await Promise.all([
    import('../../tools/index'),
    import('../agent'),
  ]);
  const agentTools = await getAgentTools(agentId);

  let systemPrompt = config.systemPrompt || '';
  const instruction =
    locale.toLowerCase() === 'cn' ? LOCALE_INSTRUCTIONS.CN : LOCALE_INSTRUCTIONS.EN;
  if (instruction && systemPrompt) {
    systemPrompt += instruction;
  }

  return new Agent(memory, provider, agentTools, { ...config, systemPrompt });
}

/**
 * One-shot initialization.
 */
export async function initAgent(
  agentId: string | AgentRole,
  options?: { workspaceId?: string }
): Promise<{
  config: import('../types/index').IAgentConfig;
  memory: import('../types/index').IMemory;
  provider: import('../providers/index').ProviderManager;
  agent: import('../agent').Agent;
}> {
  const { ConfigManager } = (await import('../registry/config')) as {
    ConfigManager: {
      getTypedConfig: <T>(
        key: string,
        defaultValue: T,
        opts?: { workspaceId?: string }
      ) => Promise<T>;
    };
  };
  const [config, { memory, provider }, locale] = await Promise.all([
    loadAgentConfig(agentId, options),
    getAgentContext(),
    ConfigManager.getTypedConfig<string>(CONFIG_KEYS.ACTIVE_LOCALE, 'en', options),
  ]);
  const agent = await createAgent(String(agentId), config, memory, provider, locale);
  return { config, memory, provider, agent };
}

/**
 * High-level agent execution helper.
 */
export async function processWithAgent(
  agentId: string | AgentRole,
  userId: string,
  task: string,
  options: ProcessOptionsParams
) {
  const { agent } = await initAgent(agentId, { workspaceId: options.workspaceId });
  return agent.process(userId, task, buildProcessOptions(options));
}

/** Options for building process options */
export interface ProcessOptionsParams {
  isContinuation?: boolean;
  isIsolated?: boolean;
  initiatorId?: string;
  depth?: number;
  traceId?: string;
  taskId?: string;
  sessionId?: string;
  workspaceId?: string;
  teamId?: string;
  staffId?: string;
  userRole?: import('../types/agent').UserRole;
  source?: TraceSource;
  profile?: ReasoningProfile;
  context?: import('aws-lambda').Context;
  responseFormat?: import('../types/index').ResponseFormat;
  communicationMode?: 'json' | 'text';
  taskTimeoutMs?: number;
  tokenBudget?: number;
  costLimit?: number;
  priorTokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  abortSignal?: AbortSignal;
}

/**
 * Build a common process options object.
 */
export function buildProcessOptions(params: ProcessOptionsParams): AgentProcessOptions {
  return {
    isContinuation: !!params.isContinuation,
    isIsolated: params.isIsolated !== false,
    initiatorId: params.initiatorId || 'orchestrator',
    depth: params.depth || 0,
    traceId: params.traceId,
    taskId: params.taskId,
    sessionId: params.sessionId,
    workspaceId: params.workspaceId,
    teamId: params.teamId,
    staffId: params.staffId,
    userRole: params.userRole,
    source: params.source || TraceSource.SYSTEM,
    profile: params.profile,
    context: params.context,
    responseFormat: params.responseFormat,
    communicationMode: params.communicationMode,
    taskTimeoutMs: params.taskTimeoutMs,
    tokenBudget: params.tokenBudget,
    costLimit: params.costLimit,
    priorTokenUsage: params.priorTokenUsage,
    abortSignal: params.abortSignal,
  };
}

/**
 * Validate required fields in agent payload.
 */
export function validatePayload(
  payload: Record<string, unknown> | null | undefined,
  requiredFields: string[]
): boolean {
  if (!payload) {
    logger.error('Invalid event payload: payload is null or undefined');
    return false;
  }
  for (const field of requiredFields) {
    if (payload[field] === undefined || payload[field] === null) {
      logger.error(`Invalid event payload: missing ${field}`);
      return false;
    }
  }
  return true;
}

/**
 * Validate an event payload against a registered schema.
 */
export function validateEventPayload<T extends object>(
  event: { detail?: T } | T,
  schemaKey: string
): T {
  const payload = extractPayload<T>(event);
  const schema = EVENT_SCHEMA_MAP[schemaKey as keyof typeof EVENT_SCHEMA_MAP];

  if (!schema) {
    logger.warn(`No schema found for key "${schemaKey}", falling back to basic extraction`);
    return payload;
  }

  try {
    return schema.parse(payload) as T;
  } catch (error) {
    logger.error(`Event validation failed for schema "${schemaKey}":`, error);
    throw new Error(
      `Event validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get the agent context (memory, provider) lazily.
 */
export async function getAgentContext(): Promise<{
  memory: import('../types/index').IMemory;
  provider: import('../providers/index').ProviderManager;
}> {
  const [{ DynamoMemory }, { CachedMemory }, { ProviderManager }] = await Promise.all([
    import('../memory'),
    import('../memory/cached-memory'),
    import('../providers/index'),
  ]);

  // Singleton pattern
  const store = globalThis as any;
  if (!store._agentMemory) {
    store._agentMemory = new CachedMemory(new DynamoMemory());
  }
  if (!store._agentProvider) {
    store._agentProvider = new ProviderManager();
  }

  return {
    memory: store._agentMemory as import('../types/index').IMemory,
    provider: store._agentProvider as import('../providers/index').ProviderManager,
  };
}
