import { skillSchema } from '../definitions/skills';
import { formatErrorMessage } from '../../../lib/utils/error';
import { logger } from '../../../lib/logger';

/**
 * Searches the project for matching skill definitions.
 */
export const discoverSkills = {
  ...skillSchema.discoverSkills,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const { query, workspaceId } = args as { query?: string; workspaceId?: string };
    try {
      const { SkillRegistry } = await import('../../../lib/skills');
      const skills = await SkillRegistry.findSkillsByKeyword(query ?? '', { workspaceId });
      if (skills.length === 0) return 'No matching skills found.';

      return (
        `Found ${skills.length} matching skills:\n` +
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        skills.map((s: any) => `- ${s['name']}: ${s['description']}`).join('\n')
      );
    } catch (error) {
      return `Failed to discover skills: ${formatErrorMessage(error)}`;
    }
  },
};

/**
 * Installs a skill for a specific agent.
 */
export const installSkill = {
  ...skillSchema.installSkill,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const { skillName, agentId, workspaceId, sessionId } = args as {
      skillName: string;
      agentId: string;
      workspaceId?: string;
      sessionId?: string;
    };
    try {
      const { SkillRegistry } = await import('../../../lib/skills');
      await SkillRegistry.installSkill(agentId, skillName, { workspaceId, sessionId });
      return `Skill '${skillName}' successfully installed for agent ${agentId}`;
    } catch (error) {
      return `Failed to install skill: ${formatErrorMessage(error)}`;
    }
  },
};

/**
 * Uninstalls a skill from a specific agent.
 */
export const uninstallSkill = {
  ...skillSchema.uninstallSkill,
  requiredPermissions: ['config:update'],
  execute: async (
    args: Record<string, unknown>,
    context?: { userId?: string }
  ): Promise<string> => {
    const { skillName, agentId, workspaceId } = args as {
      skillName: string;
      agentId: string;
      workspaceId?: string;
    };

    // RBAC Check
    if (context?.userId) {
      const { getIdentityManager, UserRole } = await import('../../../lib/session/identity');
      const identity = await getIdentityManager();
      const user = await identity.getUser(context.userId);

      if (!user || (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN)) {
        logger.warn(`Unauthorized uninstallSkill attempt by ${context.userId} on ${agentId}`);
        return 'FAILED: Unauthorized. Only OWNER or ADMIN can uninstall skills.';
      }
    }

    try {
      const { ConfigManager } = await import('../../../lib/registry/config');
      const toolsKey = `${agentId}_tools`;
      const currentTools = (await ConfigManager.getRawConfig(toolsKey, {
        workspaceId,
      })) as string[];

      if (!currentTools || !currentTools.includes(skillName)) {
        return `FAILED: Skill '${skillName}' is not installed for agent ${agentId}`;
      }

      const updatedTools = currentTools.filter((t) => t !== skillName);
      await ConfigManager.saveRawConfig(toolsKey, updatedTools, { workspaceId });

      return `Successfully uninstalled skill '${skillName}' from agent ${agentId}`;
    } catch (error) {
      return `Failed to uninstall skill: ${formatErrorMessage(error)}`;
    }
  },
};
