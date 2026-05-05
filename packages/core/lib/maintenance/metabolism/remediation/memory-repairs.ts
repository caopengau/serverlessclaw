import { logger } from '../../../logger';
import { BaseMemoryProvider } from '../../../memory/base';
import { cullResolvedGaps } from '../../../memory/gap-operations';
import { AuditFinding } from '../../../../agents/cognition-reflector/lib/audit-definitions';

/**
 * Remediation for memory/gap inconsistencies.
 */
export async function remediateMemoryFailure(
  memory: BaseMemoryProvider,
  workspaceId?: string
): Promise<AuditFinding | undefined> {
  try {
    await cullResolvedGaps(memory, undefined, workspaceId);
    return {
      silo: 'Metabolism',
      expected: 'Clean memory state',
      actual: `Real-time repair: Culled resolved gaps to resolve memory inconsistency.`,
      severity: 'P2',
      recommendation: 'Autonomous repair executed successfully.',
    };
  } catch (e) {
    logger.error(`[Metabolism] Memory gap remediation failed:`, e);
  }
  return undefined;
}
