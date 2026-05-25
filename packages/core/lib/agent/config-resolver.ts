import { IAgentConfig, ReasoningProfile } from '../types/index';
import { SYSTEM, CONFIG_KEYS, OPTIMIZATION_POLICIES } from '../constants';
import { ConfigManager } from '../registry/config';
import { logger } from '../logger';
import {
  LLMProvider,
  OpenAIModel,
  BedrockModel,
  OpenRouterModel,
  MiniMaxModel,
  DeepSeekModel,
} from '../types/llm';

const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  [LLMProvider.OPENAI]: SYSTEM.DEFAULT_OPENAI_MODEL,
  [LLMProvider.BEDROCK]: SYSTEM.DEFAULT_BEDROCK_MODEL,
  [LLMProvider.OPENROUTER]: SYSTEM.DEFAULT_OPENROUTER_MODEL,
  [LLMProvider.MINIMAX]: SYSTEM.DEFAULT_MINIMAX_MODEL,
  [LLMProvider.DEEPSEEK]: SYSTEM.DEFAULT_DEEPSEEK_MODEL,
};

function isModelCompatibleWithProvider(provider: string, model: string): boolean {
  switch (provider) {
    case LLMProvider.OPENAI:
      return Object.values(OpenAIModel).includes(model as OpenAIModel);
    case LLMProvider.BEDROCK:
      return Object.values(BedrockModel).includes(model as BedrockModel);
    case LLMProvider.OPENROUTER:
      return Object.values(OpenRouterModel).includes(model as OpenRouterModel);
    case LLMProvider.MINIMAX:
      return Object.values(MiniMaxModel).includes(model as MiniMaxModel);
    case LLMProvider.DEEPSEEK:
      return Object.values(DeepSeekModel).includes(model as DeepSeekModel);
    default:
      return true;
  }
}

/**
 * Resolves the active model, provider, and reasoning profile for an agent.
 */
export async function resolveAgentConfig(
  agentConfig: IAgentConfig | undefined,
  requestedProfile?: ReasoningProfile
) {
  let activeModel = agentConfig?.model ?? SYSTEM.DEFAULT_MODEL;
  let activeProvider = agentConfig?.provider ?? SYSTEM.DEFAULT_PROVIDER;
  let activeProfile =
    requestedProfile ?? agentConfig?.reasoningProfile ?? ReasoningProfile.STANDARD;

  try {
    const globalProvider = (await ConfigManager.getRawConfig(
      CONFIG_KEYS.ACTIVE_PROVIDER
    )) as string;
    const globalModel = (await ConfigManager.getRawConfig(CONFIG_KEYS.ACTIVE_MODEL)) as string;

    if (globalProvider) activeProvider = globalProvider;
    if (globalModel) activeModel = globalModel;

    if (!globalProvider && !globalModel && agentConfig) {
      const { AgentRouter } = await import('../routing/AgentRouter');
      const routed = await AgentRouter.selectModel(agentConfig, { profile: activeProfile });
      activeProvider = routed.provider;
      activeModel = routed.model;
    }

    if (!process.env.VITEST) {
      const policy = await ConfigManager.getRawConfig(CONFIG_KEYS.OPTIMIZATION_POLICY);
      if (policy === OPTIMIZATION_POLICIES.AGGRESSIVE) activeProfile = ReasoningProfile.DEEP;
      else if (policy === OPTIMIZATION_POLICIES.CONSERVATIVE) activeProfile = ReasoningProfile.FAST;

      if (!globalModel && !activeModel) {
        const profileMap = (await ConfigManager.getRawConfig(
          CONFIG_KEYS.REASONING_PROFILES
        )) as Record<string, string>;
        if (profileMap?.[activeProfile]) activeModel = profileMap[activeProfile];
      }
    }
  } catch {
    logger.warn('Failed to fetch config from DDB, using defaults.');
  }

  if (!isModelCompatibleWithProvider(activeProvider, activeModel)) {
    const fallbackModel = PROVIDER_DEFAULT_MODELS[activeProvider] ?? SYSTEM.DEFAULT_MODEL;
    logger.warn(
      `[resolveAgentConfig] Incompatible provider/model detected: ${activeProvider}/${activeModel}. Falling back to ${fallbackModel}.`
    );
    activeModel = fallbackModel;
  }

  return { activeModel, activeProvider, activeProfile };
}
