import { IToolDefinition } from './types/tool';
import { AgentRegistry } from './registry';
import { logger } from './logger';
import { DYNAMO_KEYS } from './constants';

/**
 * SkillRegistry handles dynamic discovery and loading of agent capabilities.
 * It moves beyond static tool registration to a "Just-in-Time" capabilities model.
 * Verified and updated on 3/19/2026.
 */
export class SkillRegistry {
  /**
   * Finds relevant skills based on keyword matching in name/description.
   * Uses simple substring matching - does NOT perform semantic vector search.
   * This allows agents to find tools they need without them being in the initial context.
   */
  static async findSkillsByKeyword(
    query: string,
    _options?: { workspaceId?: string }
  ): Promise<IToolDefinition[]> {
    const { TOOLS } = await import('../tools/index');
    const { MCPBridge } = await import('./mcp/mcp-bridge');

    const allLocalTools = Object.values(TOOLS);
    const allExternalTools = await MCPBridge.getExternalTools();

    const allCapabilities = [...allLocalTools, ...allExternalTools];
    const searchTerms = query.toLowerCase().split(' ');

    return allCapabilities
      .filter((tool) => {
        const desc = tool.description.toLowerCase();
        const name = tool.name.toLowerCase();
        return searchTerms.some((term) => desc.includes(term) || name.includes(term));
      })
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        argSchema: (tool as import('./types/index').ITool).argSchema,
        type: tool.type,
        connectionProfile: (tool as import('./types/index').ITool).connectionProfile,
        connector_id: (tool as import('./types/index').ITool).connector_id,
        auth: (tool as import('./types/index').ITool).auth,
        requiresApproval: (tool as import('./types/index').ITool).requiresApproval,
        requiredPermissions: (tool as import('./types/index').ITool).requiredPermissions,
      }));
  }

  /**
   * @deprecated Use findSkillsByKeyword instead. This alias maintained for backwards compatibility.
   */
  static async discoverSkills(
    query: string,
    options?: { workspaceId?: string }
  ): Promise<IToolDefinition[]> {
    return this.findSkillsByKeyword(query, options);
  }

  /**
   * Dynamically "installs" a skill for a specific agent session.
   * Uses atomic map updates to prevent race conditions (Principle 13).
   *
   * @param agentId - The ID of the agent receiving the skill.
   * @param skillName - The name of the tool/skill to install.
   * @param options - Optional configuration (ttlMinutes, workspaceId).
   */
  static async installSkill(
    agentId: string,
    skillName: string,
    options?: { ttlMinutes?: number; workspaceId?: string }
  ): Promise<void> {
    const { ConfigManager } = await import('./registry/config');
    const { ttlMinutes, workspaceId } = options || {};

    const currentConfig = await AgentRegistry.getAgentConfig(agentId, { workspaceId });
    if (!currentConfig) throw new Error(`Agent ${agentId} not found`);

    const perAgentTools = Array.isArray(currentConfig.tools) ? currentConfig.tools : [];
    const exists = perAgentTools.some((t) =>
      typeof t === 'string'
        ? t === skillName
        : (t as import('./types/agent').InstalledSkill).name === skillName
    );

    if (exists) return;

    const newTool = ttlMinutes
      ? { name: skillName, expiresAt: Date.now() + ttlMinutes * 60 * 1000 }
      : skillName;

    // Persist batch override atomically (Principle 13)
    await ConfigManager.atomicAppendToMapList(
      DYNAMO_KEYS.AGENT_TOOL_OVERRIDES,
      agentId,
      [newTool],
      { workspaceId, preventDuplicates: true }
    );

    // Initialize tool stats for metabolism tracking (Lean Evolution)
    await AgentRegistry.initializeToolStats([skillName], { workspaceId });

    // Also persist per-agent tools for compatibility with existing consumers/tests
    await AgentRegistry.saveRawConfig(`${agentId}_tools`, [...perAgentTools, newTool], {
      workspaceId,
    });

    logger.info(
      `Skill '${skillName}' installed for ${agentId}${ttlMinutes ? ` (Expires in ${ttlMinutes}m)` : ''}`
    );
  }
}
