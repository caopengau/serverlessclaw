import { logger } from '../logger';
import { ConfigManager } from './config';
import { DYNAMO_KEYS } from '../constants';
import type { IAgentConfig } from '../types/index';

/**
 * Handles metabolic pruning of unused configurations and tools.
 */
export class PruningRegistry {
  /**
   * Performs metabolic pruning of low-utilization tools for a specific workspace.
   */
  static async pruneLowUtilizationTools(
    getAllConfigs: (scope?: { workspaceId?: string }) => Promise<Record<string, IAgentConfig>>,
    getAgentConfig: (
      id: string,
      scope?: { workspaceId?: string }
    ) => Promise<IAgentConfig | undefined>,
    workspaceId: string = 'default',
    daysThreshold: number = 30
  ): Promise<number> {
    const scope = workspaceId !== 'default' ? { workspaceId } : undefined;
    const usage = (await ConfigManager.getRawConfig(DYNAMO_KEYS.TOOL_USAGE, scope)) as Record<
      string,
      { count: number; firstRegistered: number }
    >;
    if (!usage) return 0;

    const thresholdMs = daysThreshold * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const lowUtilTools = Object.entries(usage)
      .filter(([, stats]) => stats.count === 0 && now - stats.firstRegistered > thresholdMs)
      .map(([name]) => name);

    if (lowUtilTools.length === 0) return 0;

    const allConfigs = await getAllConfigs(scope);
    let totalPruned = 0;

    for (const agentId of Object.keys(allConfigs)) {
      const config = await getAgentConfig(agentId, scope);
      if (!config) continue;

      const pruneTargets = config.tools?.filter((t) => lowUtilTools.includes(t)) ?? [];
      if (pruneTargets.length > 0) {
        await ConfigManager.atomicRemoveFromMap(
          DYNAMO_KEYS.AGENT_TOOL_OVERRIDES,
          agentId,
          pruneTargets,
          scope
        ).catch((e) => logger.warn(`[PruningRegistry] Failed to prune tools for ${agentId}:`, e));
        totalPruned += pruneTargets.length;
      }
    }
    return totalPruned;
  }
}
