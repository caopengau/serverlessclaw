import { METRICS, emitMetrics } from './metrics';
import { logger } from '../logger';

/**
 * Evolution Metrics Utility
 *
 * Provides specialized metrics for monitoring the self-evolution loop,
 * including idempotency suppressions, state transition rejections,
 * parallel barrier timeouts, and retry bursts.
 */
export const EVOLUTION_METRICS = {
  /**
   * Records a duplicate continuation event that was suppressed by the idempotency layer.
   */
  recordDuplicateSuppression(source: string): void {
    emitMetrics([
      {
        MetricName: 'EvolutionDuplicateSuppression',
        Value: 1,
        Unit: 'Count',
        Dimensions: [{ Name: 'Source', Value: source }],
      },
    ]).catch((err) => logger.warn('Failed to emit EvolutionDuplicateSuppression metric:', err));
  },

  /**
   * Records a failed gap state transition (e.g., due to lock contention or invalid guard).
   */
  recordTransitionRejection(
    gapId: string,
    fromStatus: string,
    toStatus: string,
    reason: string
  ): void {
    emitMetrics([
      {
        MetricName: 'EvolutionTransitionRejection',
        Value: 1,
        Unit: 'Count',
        Dimensions: [
          { Name: 'FromStatus', Value: fromStatus },
          { Name: 'ToStatus', Value: toStatus },
          { Name: 'Reason', Value: reason },
        ],
      },
    ]).catch((err) => logger.warn('Failed to emit EvolutionTransitionRejection metric:', err));
  },

  /**
   * Records a parallel barrier timeout event.
   */
  recordBarrierTimeout(traceId: string, taskCount: number, completedCount: number): void {
    emitMetrics([
      {
        MetricName: 'EvolutionBarrierTimeout',
        Value: 1,
        Unit: 'Count',
        Dimensions: [
          { Name: 'TaskCount', Value: String(taskCount) },
          {
            Name: 'CompletionRate',
            Value: String(taskCount > 0 ? (completedCount / taskCount).toFixed(2) : 0),
          },
        ],
      },
    ]).catch((err) => logger.warn('Failed to emit EvolutionBarrierTimeout metric:', err));
  },

  /**
   * Records a gap being reopened (retry) after a failure.
   */
  recordGapReopen(gapId: string, attemptCount: number): void {
    emitMetrics([
      {
        MetricName: 'EvolutionGapReopen',
        Value: 1,
        Unit: 'Count',
        Dimensions: [{ Name: 'AttemptCount', Value: String(attemptCount) }],
      },
    ]).catch((err) => logger.warn('Failed to emit EvolutionGapReopen metric:', err));
  },

  /**
   * Records a lock acquisition failure.
   */
  recordLockContention(lockId: string, agentId: string): void {
    emitMetrics([
      METRICS.lockAcquired(lockId, false),
      {
        MetricName: 'EvolutionLockContention',
        Value: 1,
        Unit: 'Count',
        Dimensions: [
          { Name: 'LockId', Value: lockId },
          { Name: 'AgentId', Value: agentId },
        ],
      },
    ]).catch((err) => logger.warn('Failed to emit EvolutionLockContention metric:', err));
  },

  /**
   * Records tool execution metrics for ROI analysis.
   */
  recordToolExecution(
    toolName: string,
    success: boolean,
    durationMs: number,
    options?: { workspaceId?: string; orgId?: string }
  ): void {
    emitMetrics([
      {
        MetricName: 'ToolExecutionCount',
        Value: 1,
        Unit: 'Count',
        Dimensions: [
          { Name: 'ToolName', Value: toolName },
          { Name: 'Success', Value: String(success) },
          { Name: 'OrgId', Value: options?.orgId || 'GLOBAL' },
        ],
      },
      {
        MetricName: 'ToolExecutionDuration',
        Value: durationMs,
        Unit: 'Milliseconds',
        Dimensions: [{ Name: 'ToolName', Value: toolName }],
      },
    ]).catch((err) => logger.warn('Failed to emit ToolExecution metrics:', err));
  },

  /**
   * Records estimated ROI value for a tool execution.
   */
  recordToolROI(
    toolName: string,
    estimatedValue: number,
    actualCost: number,
    options?: { workspaceId?: string; orgId?: string }
  ): void {
    emitMetrics([
      {
        MetricName: 'ToolROIValue',
        Value: estimatedValue,
        Unit: 'Count',
        Dimensions: [
          { Name: 'ToolName', Value: toolName },
          { Name: 'OrgId', Value: options?.orgId || 'GLOBAL' },
        ],
      },
      {
        MetricName: 'ToolROICost',
        Value: actualCost,
        Unit: 'Count',
        Dimensions: [
          { Name: 'ToolName', Value: toolName },
          { Name: 'OrgId', Value: options?.orgId || 'GLOBAL' },
        ],
      },
    ]).catch((err) => logger.warn('Failed to emit ToolROI metrics:', err));
  },
};
