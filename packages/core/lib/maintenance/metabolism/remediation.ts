import { logger } from '../../logger';
import { BaseMemoryProvider } from '../../memory/base';
import { AuditFinding } from '../../../agents/cognition-reflector/lib/audit-definitions';
import { setGap } from '../../memory/gap-operations';
import { InsightCategory } from '../../types/memory';
import { EvolutionScheduler } from '../../safety/evolution-scheduler';
import { FailureEventPayload } from '../../schema/events';
import { remediateToolFailure } from './remediation/tool-repairs';
import { remediateS3Failure } from './remediation/storage-repairs';
import { remediateMemoryFailure } from './remediation/memory-repairs';

/**
 * Performs immediate remediation for a detected dashboard failure.
 * Sh7: Live remediation bridge for real-time system stability.
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
    const toolFinding = await remediateToolFailure(failure, workspaceId);
    if (toolFinding) return toolFinding;
  }

  // 2. S3/Storage Remediation
  if (error.includes('s3') || error.includes('access denied') || error.includes('not found')) {
    const s3Finding = await remediateS3Failure(workspaceId);
    if (s3Finding) return s3Finding;
  }

  // 3. Memory/Gap Remediation
  if (error.includes('memory') || error.includes('gap')) {
    const memoryFinding = await remediateMemoryFailure(memory, workspaceId);
    if (memoryFinding) return memoryFinding;
  }

  // Fallback: Schedule HITL evolution for complex/unknown errors
  logger.warn(`[Metabolism] Complex error detected, scheduling HITL remediation: ${failure.error}`);
  const scheduler = new EvolutionScheduler(memory);
  await scheduler.scheduleAction({
    agentId: failure.agentId || 'unknown',
    action: 'REMEDIATION',
    reason: `Unresolved dashboard error: ${failure.error}`,
    timeoutMs: 3600000,
    traceId: failure.traceId,
    userId: failure.userId,
    workspaceId: workspaceId || 'SYSTEM',
  });

  await setGap(
    memory,
    `REMEDIATION-${failure.traceId}`,
    `Immediate remediation required: ${failure.error}`,
    { category: InsightCategory.STRATEGIC_GAP, urgency: 5, impact: 8 },
    workspaceId
  );

  return undefined;
}
