import {
  IProvider,
  Message,
  ITool,
  ReasoningProfile,
  LLMProvider,
  OpenAIModel,
  BedrockModel,
  OpenRouterModel,
} from '../types/index';
import { Resource } from 'sst';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../logger';

import { OpenAIProvider } from './openai';
import { OpenRouterProvider } from './openrouter';
import { BedrockProvider } from './bedrock';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

interface ProviderResource {
  ActiveProvider?: { value: string };
  ActiveModel?: { value: string };
  ConfigTable: { name: string };
}

export class ProviderManager implements IProvider {
  static async getActiveProvider(
    overrideProvider?: string,
    overrideModel?: string
  ): Promise<IProvider> {
    const typedResource = Resource as unknown as ProviderResource;
    let providerType =
      overrideProvider || typedResource.ActiveProvider?.value || LLMProvider.OPENAI;
    let model = overrideModel || typedResource.ActiveModel?.value;

    if (!overrideProvider || !overrideModel) {
      try {
        if (!overrideProvider) {
          const { Item } = await db.send(
            new GetCommand({
              TableName: typedResource.ConfigTable.name,
              Key: { key: 'active_provider' },
            })
          );
          if (Item && Item.value) {
            providerType = Item.value;
          }
        }

        if (!overrideModel) {
          const { Item: modelItem } = await db.send(
            new GetCommand({
              TableName: typedResource.ConfigTable.name,
              Key: { key: 'active_model' },
            })
          );
          if (modelItem && modelItem.value) {
            model = modelItem.value;
          }
        }
      } catch (e) {
        logger.warn('Could not fetch hot config from ConfigTable, falling back to secrets:', e);
      }
    }

    switch (providerType) {
      case LLMProvider.BEDROCK:
        return new BedrockProvider(model || BedrockModel.CLAUDE_4_6);
      case LLMProvider.OPENROUTER:
        return new OpenRouterProvider(model || OpenRouterModel.GEMINI_3_FLASH);
      case LLMProvider.OPENAI:
      default:
        return new OpenAIProvider(model || OpenAIModel.GPT_5_4);
    }
  }

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

  async getCapabilities(model?: string) {
    const provider = await ProviderManager.getActiveProvider(undefined, model);
    return provider.getCapabilities(model);
  }
}
