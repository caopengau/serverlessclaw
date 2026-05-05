import { logger } from '../../logger';
import { AgentRole, AGENT_TYPES, CONFIG_KEYS } from '../../constants';
import { loadAgentConfig, createAgent } from './core';

/**
 * Get the agent context (memory, provider) lazily.
 */
export async function getAgentContext(): Promise<{
  memory: import('../../types/index').IMemory;
  provider: import('../../providers/index').ProviderManager;
}> {
  const [{ DynamoMemory }, { CachedMemory }, { ProviderManager }] = await Promise.all([
    import('../../memory'),
    import('../../memory/cached-memory'),
    import('../../providers/index'),
  ]);

  const store = globalThis as any;
  if (!store._agentMemory) {
    store._agentMemory = new CachedMemory(new DynamoMemory());
  }
  if (!store._agentProvider) {
    store._agentProvider = new ProviderManager();
  }

  return {
    memory: store._agentMemory as import('../../types/index').IMemory,
    provider: store._agentProvider as import('../../providers/index').ProviderManager,
  };
}

/**
 * One-shot initialization.
 */
export async function initAgent(
  agentId: string | AgentRole,
  options?: { workspaceId?: string }
): Promise<{
  config: import('../../types/index').IAgentConfig;
  memory: import('../../types/index').IMemory;
  provider: import('../../providers/index').ProviderManager;
  agent: import('../../agent').Agent;
}> {
  const { ConfigManager } = (await import('../../registry/config')) as {
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

export function isWarmupEvent(event: unknown): boolean {
  const { extractPayload } = require('./validation');
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
