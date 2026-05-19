import { IAgentConfig, ITool, IMemory, IProvider, MCPServerConfig } from './types';
import { logger } from './logger';

export interface WebhookConfig {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  handler:
    | string
    | ((payload: Record<string, unknown>, context: Record<string, unknown>) => Promise<unknown>);
}

export interface ApprovalPolicy {
  approvers: string[];
  timeoutSeconds?: number;
  messageTemplate?: string;
  requiredCount?: number;
}

export interface ClawPlugin {
  id: string;
  agents?: Record<string, IAgentConfig>;
  tools?: Record<string, ITool>;
  mcpServers?: Record<string, MCPServerConfig>;
  prompts?: Record<string, string>;
  memoryProviders?: Record<string, IMemory>;
  llmProviders?: Record<string, IProvider>;
  webhooks?: Record<string, WebhookConfig>;
  approvalPolicies?: Record<string, ApprovalPolicy>;
  sidebarExtensions?: unknown[];
  layoutExtensions?: unknown[];
  onInit?: () => Promise<void>;
}

/**
 * PluginManager enables monorepo projects to register capabilities
 * without modifying the core codebase.
 */
export class PluginManager {
  private static plugins: Map<string, ClawPlugin> = new Map();
  private static initialized = false;

  static async register(plugin: ClawPlugin) {
    if (this.plugins.has(plugin.id)) {
      logger.warn(`[PluginManager] Plugin "${plugin.id}" already registered. Overwriting.`);
    }
    this.plugins.set(plugin.id, plugin);
    logger.info(`[PluginManager] Registered plugin: ${plugin.id}`);

    if (plugin.onInit) {
      await plugin.onInit();
    }
  }

  /**
   * Retrieves all registered plugins.
   */
  static getAllPlugins(): ClawPlugin[] {
    return Array.from(this.plugins.values());
  }

  static getRegisteredAgents(): Record<string, IAgentConfig> {
    const agents: Record<string, IAgentConfig> = {};
    for (const plugin of this.plugins.values()) {
      if (plugin.agents) {
        Object.assign(agents, plugin.agents);
      }
    }
    return agents;
  }

  static getRegisteredTools(): Record<string, ITool> {
    const tools: Record<string, ITool> = {};
    for (const plugin of this.plugins.values()) {
      if (plugin.tools) {
        Object.assign(tools, plugin.tools);
      }
    }
    return tools;
  }

  static getRegisteredMCPServers(): Record<string, MCPServerConfig> {
    const servers: Record<string, MCPServerConfig> = {};
    for (const plugin of this.plugins.values()) {
      if (plugin.mcpServers) {
        Object.assign(servers, plugin.mcpServers);
      }
    }
    return servers;
  }

  static getRegisteredPrompts(): Record<string, string> {
    const prompts: Record<string, string> = {};
    for (const plugin of this.plugins.values()) {
      if (plugin.prompts) {
        Object.assign(prompts, plugin.prompts);
      }
    }
    return prompts;
  }

  static getRegisteredLLMProviders(): Record<string, IProvider> {
    const providers: Record<string, IProvider> = {};
    for (const plugin of this.plugins.values()) {
      if (plugin.llmProviders) {
        Object.assign(providers, plugin.llmProviders);
      }
    }
    return providers;
  }

  static getRegisteredMemoryProviders(): Record<string, IMemory> {
    const providers: Record<string, IMemory> = {};
    for (const plugin of this.plugins.values()) {
      if (plugin.memoryProviders) {
        Object.assign(providers, plugin.memoryProviders);
      }
    }
    return providers;
  }

  static getRegisteredWebhooks(): Record<string, WebhookConfig> {
    const webhooks: Record<string, WebhookConfig> = {};
    for (const plugin of this.plugins.values()) {
      if (plugin.webhooks) {
        Object.assign(webhooks, plugin.webhooks);
      }
    }
    return webhooks;
  }

  static getRegisteredApprovalPolicies(): Record<string, ApprovalPolicy> {
    const policies: Record<string, ApprovalPolicy> = {};
    for (const plugin of this.plugins.values()) {
      if (plugin.approvalPolicies) {
        Object.assign(policies, plugin.approvalPolicies);
      }
    }
    return policies;
  }

  static async initialize() {
    if (this.initialized) return;

    // Auto-discovery of internal plugins could go here if we had a standard path
    // For now, we rely on explicit registration in the entry points.

    this.initialized = true;
    logger.info(`[PluginManager] Initialized with ${this.plugins.size} plugins.`);
  }
}
