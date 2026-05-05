import { knowledgeSchema } from './schema';
import { ConfigManager } from '../../lib/registry/config';
import { formatErrorMessage } from '../../lib/utils/error';
import { LLMProvider, MiniMaxModel } from '../../lib/types/llm';
import { AgentCategory } from '../../lib/types/agent';

/**
 * Lists all registered agents and their current status.
 */
export const listAgents = {
  ...knowledgeSchema.listAgents,
  execute: async (args: Record<string, unknown> = {}): Promise<string> => {
    const { workspaceId } = args as { workspaceId?: string };
    const { AgentRegistry } = await import('../../lib/registry');
    const configs = await AgentRegistry.getAllConfigs({ workspaceId });

    const summary = Object.values(configs)
      .filter((a) => a.enabled && a.id !== 'superclaw')
      .map((a) => `- [${a.id}] ${a.name}: ${a.description} (Backbone: ${a.isBackbone || false})`)
      .join('\n');

    return (
      summary ||
      `No enabled agents found in the registry${workspaceId ? ` for workspace ${workspaceId}` : ''}.`
    );
  },
};

/**
 * Performs a deep cognitive health check by pinging another agent.
 */
export const pulseCheck = {
  ...knowledgeSchema.pulseCheck,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const { targetAgentId, userId, traceId, nodeId, initiatorId, sessionId, workspaceId } =
      args as {
        targetAgentId: string;
        userId: string;
        traceId: string;
        nodeId: string;
        initiatorId: string;
        sessionId: string;
        workspaceId?: string;
      };

    const { AgentRegistry } = await import('../../lib/registry');
    const isRegistered = AgentRegistry.isBackboneAgent(targetAgentId);

    if (!isRegistered) {
      return `PULSE_FAILED: Agent '${targetAgentId}' is not registered in the system backbone.`;
    }

    try {
      const { emitEvent: emit } = await import('../../lib/utils/bus');
      await emit(`${initiatorId || 'system'}.pulse`, `${targetAgentId}_task`, {
        userId,
        traceId,
        nodeId,
        initiatorId: initiatorId || 'pulse-tool',
        sessionId,
        task: 'PULSE_CHECK: Please respond with "PULSE_OK" to verify availability.',
        workspaceId,
        metadata: { isPulse: true },
      });

      return `PULSE_DISPATCHED: Request sent to ${targetAgentId}. Waiting for asynchronous heartbeat.`;
    } catch (error) {
      return `PULSE_ERROR: ${formatErrorMessage(error)}`;
    }
  },
};

/**
 * Designates a new backbone agent configuration.
 */
export const designateAgent = {
  ...knowledgeSchema.designateAgent,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const { id, name, description, systemPrompt, provider, model, workspaceId } = args as {
      id: string;
      name: string;
      description: string;
      systemPrompt: string;
      provider?: string;
      model?: string;
      workspaceId?: string;
    };

    try {
      const { AgentRegistry } = await import('../../lib/registry');
      await AgentRegistry.updateAgentConfig(
        id,
        {
          id,
          name,
          description,
          systemPrompt,
          provider: provider || LLMProvider.MINIMAX,
          model: model || MiniMaxModel.M2_7,
          category: AgentCategory.UTILITY,
          enabled: true,
        },
        { workspaceId }
      );

      return `AGENT_DESIGNATED: '${id}' (${name}) is now registered and available for delegation.`;
    } catch (error) {
      return `DESIGNATION_FAILED: ${formatErrorMessage(error)}`;
    }
  },
};

/**
 * Queries the configuration registry for a specific setting.
 */
export const queryConfig = {
  ...knowledgeSchema.queryConfig,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const { key, workspaceId } = args as { key: string; workspaceId?: string };
    const value = await ConfigManager.getRawConfig(key, { workspaceId });

    if (value === undefined) {
      return `CONFIG_NOT_FOUND: Key '${key}' does not exist in the registry.`;
    }

    return `CONFIG_VALUE: ${key} = ${JSON.stringify(value)}`;
  },
};
