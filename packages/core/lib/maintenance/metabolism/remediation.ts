import { logger } from '../../logger';
import { BaseMemoryProvider } from '../../memory/base';
import { AuditFinding } from '../../types/audit';
import { FailureEventPayload } from '../../schema/events';

/**
 * Performs immediate remediation for a detected dashboard failure.
 * Decomposed with dynamic imports to minimize static context budget.
 */
export async function remediateDashboardFailure(
  memory: BaseMemoryProvider,
  failure: FailureEventPayload
): Promise<AuditFinding | undefined> {
  const workspaceId = (failure as Record<string, unknown>).workspaceId as string | undefined;

  logger.info(
    `[Metabolism] Attempting immediate remediation for trace ${failure.traceId} in workspace ${workspaceId}`
  );

  const error = failure.error.toLowerCase();

  // 1. Tool/Registry Remediation
  if (error.includes('tool') || error.includes('registry') || error.includes('override')) {
    const { remediateToolFailure } = await import('./remediation/tool-repairs');
    const toolFinding = await remediateToolFailure(failure, workspaceId);
    if (toolFinding) return toolFinding;
  }

  // 2. S3/Storage Remediation
  if (error.includes('s3') || error.includes('access denied') || error.includes('not found')) {
    const { remediateS3Failure } = await import('./remediation/storage-repairs');
    const s3Finding = await remediateS3Failure(workspaceId);
    if (s3Finding) return s3Finding;
  }

  // 3. Memory/Gap Remediation
  if (error.includes('memory') || error.includes('gap')) {
    const { remediateMemoryFailure } = await import('./remediation/memory-repairs');
    const memoryFinding = await remediateMemoryFailure(memory, workspaceId);
    if (memoryFinding) return memoryFinding;
  }

  // Fallback: Schedule HITL evolution for complex/unknown errors
  logger.warn(`[Metabolism] Complex error detected, scheduling HITL remediation: ${failure.error}`);

  const { EvolutionScheduler } = await import('../../safety/evolution-scheduler');
  const { setGap } = await import('../../memory/gap-operations');
  const { InsightCategory } = await import('../../types/memory');
  const { CONFIG_DEFAULTS } = await import('../../config/config-defaults');

  const scheduler = new EvolutionScheduler(memory);
  await scheduler.scheduleAction({
    agentId: failure.agentId || 'unknown',
    action: 'error_remediation',
    reason: `Autonomous remediation failed for: ${failure.error}`,
    timeoutMs: CONFIG_DEFAULTS.EVOLUTIONARY_TIMEOUT_MS.code,
    traceId: failure.traceId,
    userId: failure.userId,
    workspaceId: workspaceId || 'GLOBAL',
  });

  await setGap(
    memory,
    `remedy-${failure.traceId}`,
    `Unremediated system error: ${failure.error}`,
    { category: InsightCategory.STRATEGIC_GAP, urgency: 8 },
    workspaceId
  );

  return undefined;
}
