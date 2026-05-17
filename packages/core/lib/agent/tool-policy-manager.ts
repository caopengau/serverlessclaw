import { ConfigManager } from '../registry/config';
import { ToolPolicy } from './tool-policy';

export class ToolPolicyManager {
  /**
   * Resolves a tool policy for the given workspace and tool name.
   * Leverages ConfigTable's built-in low-latency cache and tenant isolation.
   *
   * @param workspaceId - The target workspace scoping key.
   * @param toolName - The exact tool identifier.
   * @returns The active ToolPolicy, or null if no policy override exists.
   */
  public static async getPolicy(workspaceId: string, toolName: string): Promise<ToolPolicy | null> {
    const policyKey = `tool_policy_${toolName}`;
    return ConfigManager.getTypedConfig<ToolPolicy | null>(policyKey, null, {
      workspaceId,
    });
  }

  /**
   * Persists a hot-swappable tool policy.
   * Invalidates caches and triggers version snapshots.
   *
   * @param policy - The target policy object containing workspace credentials.
   */
  public static async savePolicy(policy: ToolPolicy): Promise<void> {
    const policyKey = `tool_policy_${policy.toolName}`;
    await ConfigManager.saveRawConfig(policyKey, policy, {
      workspaceId: policy.workspaceId,
      skipVersioning: false,
      author: 'system-security',
      description: `Update SwarmGuard Tool Policy for ${policy.toolName}`,
    });
  }

  /**
   * Deletes a custom tool policy override, reverting it back to static defaults.
   *
   * @param workspaceId - The target workspace scoping key.
   * @param toolName - The exact tool identifier.
   */
  public static async deletePolicy(workspaceId: string, toolName: string): Promise<void> {
    const policyKey = `tool_policy_${toolName}`;
    await ConfigManager.deleteConfig(policyKey, { workspaceId });
  }
}
