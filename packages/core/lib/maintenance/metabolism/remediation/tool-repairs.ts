import { logger } from '../../../logger';
import { ConfigManager } from '../../../registry/config';
import { AgentRegistry } from '../../../registry/AgentRegistry';
import { DYNAMO_KEYS } from '../../../constants';
import { AuditFinding } from '../../../../agents/cognition-reflector/lib/audit-definitions';
import { FailureEventPayload } from '../../../schema/events';

/**
 * Remediation for registry/tool mismatches.
 */
export async function remediateToolFailure(
  failure: FailureEventPayload,
  workspaceId?: string
): Promise<AuditFinding | undefined> {
  let pruned = false;

  const toolMatch =
    failure.error.match(/tool\s+['"]([^'"]+)['"]/i) ||
    failure.error.match(/['"]([^'"]+)['"]\s+tool/i);

  try {
    if (toolMatch && toolMatch[1]) {
      const toolName = toolMatch[1];
      const agentId = failure.agentId || 'unknown';

      logger.info(`[Metabolism] Surgical remediation for tool: ${toolName}`);
      await ConfigManager.atomicRemoveFromMap(
        DYNAMO_KEYS.AGENT_TOOL_OVERRIDES,
        agentId,
        [toolName],
        { workspaceId }
      );
      await ConfigManager.atomicRemoveFieldsFromMap(
        DYNAMO_KEYS.TOOL_METADATA_OVERRIDES,
        [toolName],
        { workspaceId }
      );
      pruned = true;
    }

    if (!pruned && workspaceId) {
      const prunedCount = await AgentRegistry.pruneLowUtilizationTools(workspaceId, 1);
      pruned = prunedCount > 0;
    }
  } catch (e) {
    logger.error(`[Metabolism] Tool override remediation failed:`, e);
  }

  if (pruned) {
    return {
      silo: 'Metabolism',
      expected: 'Consistent agent registry',
      actual: `Real-time repair: Pruned stale/failing tool overrides atomically.`,
      severity: 'P2',
      recommendation: 'Autonomous repair executed successfully via Silo 7 bridge.',
    };
  }

  return undefined;
}
