import { toolDefinitions } from './definitions/index';
import { ITool } from '../lib/types/tool';
import { formatErrorMessage } from '../lib/utils/error';
import { CONFIG_KEYS } from '../lib/constants';

// Import split tool implementations
import * as deploymentTools from './deployment';
import * as rollbackTools from './rollback';
import * as fsTools from './fs';
import * as knowledgeTools from './knowledge';
import * as schedulerTools from './scheduler';
import * as metadataTools from './metadata';
import * as debugTools from './debug';

// Filter knowledgeTools to only include ITool exports (exclude utility functions like formatErrorMessage)
const knowledgeToolEntries = Object.entries(knowledgeTools).filter(
  ([, value]) => typeof value === 'object' && value !== null && 'execute' in value
);
const knowledgeToolsFiltered = Object.fromEntries(knowledgeToolEntries) as Record<string, ITool>;

/**
 * Registry of all available tools for agents to execute.
 * Aggregates tools from specialized modules (system, fs, knowledge).
 * All tool names follow standard JavaScript camelCase naming conventions.
 */
export const TOOLS: Record<string, ITool> = {
  // System & Deployment Tools
  ...Object.fromEntries(
    Object.entries(deploymentTools).map(([k, v]) => [
      k.toLowerCase().replace(/_([a-z])/g, (g) => g[1]),
      v,
    ])
  ),
  ...Object.fromEntries(
    Object.entries(rollbackTools).map(([k, v]) => [
      k.toLowerCase().replace(/_([a-z])/g, (g) => g[1]),
      v,
    ])
  ),

  // File System & Validation Tools
  ...Object.fromEntries(
    Object.entries(fsTools).map(([k, v]) => [k.toLowerCase().replace(/_([a-z])/g, (g) => g[1]), v])
  ),

  // Knowledge & Agent Management Tools
  ...Object.fromEntries(
    Object.entries(knowledgeToolsFiltered).map(([k, v]) => [
      k.toLowerCase().replace(/_([a-z])/g, (g) => g[1]),
      v,
    ])
  ),

  // Proactive Scheduling Tools
  ...Object.fromEntries(
    Object.entries(schedulerTools).map(([k, v]) => [
      k.toLowerCase().replace(/_([a-z])/g, (g) => g[1]),
      v,
    ])
  ),

  // Metadata & SSOT Tools
  ...Object.fromEntries(
    Object.entries(metadataTools).map(([k, v]) => [
      k.toLowerCase().replace(/_([a-z])/g, (g) => g[1]),
      v,
    ])
  ),

  // Debug & Investigation Tools
  ...Object.fromEntries(
    Object.entries(debugTools).map(([k, v]) => [
      k.toLowerCase().replace(/_([a-z])/g, (g) => g[1]),
      v,
    ])
  ),

  /**
   * Switches the active LLM provider and model for the system.
   */
  SWITCH_MODEL: {
    ...toolDefinitions.switchModel,
    execute: async (args: Record<string, unknown>): Promise<string> => {
      const { provider, model } = args as { provider: string; model: string };
      try {
        const { AgentRegistry } = await import('../lib/registry');
        await AgentRegistry.saveRawConfig(CONFIG_KEYS.ACTIVE_PROVIDER, provider);
        await AgentRegistry.saveRawConfig(CONFIG_KEYS.ACTIVE_MODEL, model);
        return `Successfully switched to ${provider} with model ${model}. Hot config applied.`;
      } catch (error) {
        return `Failed to switch model: ${formatErrorMessage(error)}`;
      }
    },
  },
};

export { getAgentTools, getToolDefinitions } from './registry-utils';
