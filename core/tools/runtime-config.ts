import { Resource } from 'sst';
import { toolDefinitions } from './definitions';

/**
 * Retrieves the current runtime configuration, including active LLM provider and model.
 */
export const checkConfig = {
  ...toolDefinitions.checkConfig,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const {
      agentName,
      initiatorId,
      traceId,
      activeModel: injectedModel,
      activeProvider: injectedProvider,
    } = args as {
      agentName: string;
      initiatorId: string;
      traceId: string;
      activeModel?: string;
      activeProvider?: string;
    };

    const { AgentRegistry } = await import('../lib/registry');

    // These represent the global DDB-based overrides (from switchModel)
    const ddbProvider = await AgentRegistry.getRawConfig('active_provider');
    const ddbModel = await AgentRegistry.getRawConfig('active_model');

    return `
[RUNTIME_CONFIG]
AGENT_NAME: ${agentName}
INITIATOR: ${initiatorId}
TRACE_ID: ${traceId}
ACTIVE_PROVIDER: ${injectedProvider || ddbProvider || 'openai (default)'}
ACTIVE_MODEL: ${injectedModel || ddbModel || 'gpt-4o-mini (default)'}
STAGING_BUCKET: ${Resource.StagingBucket.name}
    `.trim();
  },
};
