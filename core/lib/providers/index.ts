import { IProvider, Message, ITool, ReasoningProfile, LLMProvider } from '../types/index';
import { Resource } from 'sst';

import { OpenAIProvider } from './openai';
import { OpenRouterProvider } from './openrouter';
import { BedrockProvider } from './bedrock';
import { SYSTEM, CONFIG_KEYS } from '../constants';
import { ConfigManager } from '../registry/config';

interface ProviderResource {
  ActiveProvider?: { value: string };
  ActiveModel?: { value: string };
  ConfigTable: { name: string };
}

/**
 * ProviderManager handles the resolution and execution of LLM provider calls.
 * It acts as a central hub for switching between OpenAI, Bedrock, and OpenRouter.
 */
export class ProviderManager implements IProvider {
  /**
   * Resolves the active provider and model using a hierarchy:
   * 1. Direct overrides (parameters)
   * 2. Hot configuration (DynamoDB ConfigTable)
   * 3. SST Static Resources (if linked)
   * 4. System Constants (last resort)
   *
   * @param overrideProvider - Optional provider name to override defaults.
   * @param overrideModel - Optional model name to override defaults.
   * @returns A promise resolving to the active IProvider implementation.
   */
  static async getActiveProvider(
    overrideProvider?: string,
    overrideModel?: string
  ): Promise<IProvider> {
    const typedResource = Resource as unknown as ProviderResource;

    // Resolve Provider
    const providerType = (overrideProvider ??
      (await ConfigManager.getTypedConfig(
        CONFIG_KEYS.ACTIVE_PROVIDER,
        typedResource.ActiveProvider?.value ?? SYSTEM.DEFAULT_PROVIDER
      ))) as LLMProvider;

    // Resolve Model
    const model =
      overrideModel ??
      ((await ConfigManager.getRawConfig(CONFIG_KEYS.ACTIVE_MODEL)) as string) ??
      typedResource.ActiveModel?.value;

    switch (providerType) {
      case LLMProvider.BEDROCK:
        return new BedrockProvider(model ?? SYSTEM.DEFAULT_BEDROCK_MODEL);
      case LLMProvider.OPENROUTER:
        return new OpenRouterProvider(model ?? SYSTEM.DEFAULT_OPENROUTER_MODEL);
      case LLMProvider.OPENAI:
      default:
        return new OpenAIProvider(model ?? SYSTEM.DEFAULT_OPENAI_MODEL);
    }
  }

  /**
   * Performs a completion call to the active LLM provider.
   *
   * @param messages - The conversation history.
   * @param tools - Optional tools available to the LLM.
   * @param profile - The desired reasoning profile.
   * @param model - Optional model override.
   * @param provider - Optional provider override.
   * @param responseFormat - Optional structured output format.
   * @returns A promise resolving to the AI response message.
   */
  async call(
    messages: Message[],
    tools?: ITool[],
    profile: ReasoningProfile = ReasoningProfile.STANDARD,
    model?: string,
    provider?: string,
    responseFormat?: import('../types/index').ResponseFormat
  ): Promise<Message> {
    const activeProvider = await ProviderManager.getActiveProvider(provider, model);
    return activeProvider.call(messages, tools, profile, model, undefined, responseFormat);
  }

  /**
   * Retrieves the capabilities of the active model.
   *
   * @param model - Optional model identifier.
   * @returns A promise resolving to the capabilities of the model.
   */
  async getCapabilities(model?: string) {
    const provider = await ProviderManager.getActiveProvider(undefined, model);
    return provider.getCapabilities(model);
  }
}
