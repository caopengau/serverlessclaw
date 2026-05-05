import { emitMetrics } from './metrics';
import { logger } from '../logger';

/**
 * Evolution Metrics Utility
 */
export const EVOLUTION_METRICS = {
  /**
   * Records a duplicate continuation event that was suppressed.
   */
  recordDuplicateSuppression(
    source: string,
    scope?: { workspaceId?: string; orgId?: string; teamId?: string; staffId?: string }
  ): void {
    const dimensions = [{ Name: 'Source', Value: source }];
    if (scope?.workspaceId) dimensions.push({ Name: 'WorkspaceId', Value: scope.workspaceId });
    if (scope?.orgId) dimensions.push({ Name: 'OrgId', Value: scope.orgId });

    emitMetrics([
      {
        MetricName: 'EvolutionDuplicateSuppression',
        Value: 1,
        Unit: 'Count',
        Dimensions: dimensions,
      },
    ]).catch((err) => logger.warn('Failed to emit EvolutionDuplicateSuppression metric:', err));
  },

  /**
   * Records a failed gap state transition.
   */
  recordTransitionRejection(
    gapId: string,
    fromStatus: string,
    toStatus: string,
    reason: string,
    scope?: { workspaceId?: string; orgId?: string; teamId?: string; staffId?: string }
  ): void {
    const dimensions = [
      { Name: 'FromStatus', Value: fromStatus },
      { Name: 'ToStatus', Value: toStatus },
      { Name: 'Reason', Value: reason },
    ];
    if (scope?.workspaceId) dimensions.push({ Name: 'WorkspaceId', Value: scope.workspaceId });

    emitMetrics([
      {
        MetricName: 'EvolutionTransitionRejection',
        Value: 1,
        Unit: 'Count',
        Dimensions: dimensions,
      },
    ]).catch((err) => logger.warn('Failed to emit EvolutionTransitionRejection metric:', err));
  },

  /**
   * Records contention on a gap lock.
   */
  recordLockContention(
    gapId: string,
    agentId: string,
    scope?: { workspaceId?: string; orgId?: string }
  ): void {
    const dimensions = [{ Name: 'AgentId', Value: agentId }];
    if (scope?.workspaceId) dimensions.push({ Name: 'WorkspaceId', Value: scope.workspaceId });

    emitMetrics([
      {
        MetricName: 'EvolutionLockContention',
        Value: 1,
        Unit: 'Count',
        Dimensions: dimensions,
      },
    ]).catch((err) => logger.warn('Failed to emit EvolutionLockContention metric:', err));
  },

  /**
   * Records the outcome of an evolutionary step.
   */
  recordEvolutionOutcome(
    track: string,
    success: boolean,
    durationMs: number,
    scope?: { workspaceId?: string; orgId?: string }
  ): void {
    const dimensions = [
      { Name: 'Track', Value: track },
      { Name: 'Success', Value: String(success) },
    ];
    if (scope?.workspaceId) dimensions.push({ Name: 'WorkspaceId', Value: scope.workspaceId });

    emitMetrics([
      {
        MetricName: 'EvolutionOutcome',
        Value: success ? 1 : 0,
        Unit: 'Count',
        Dimensions: dimensions,
      },
      {
        MetricName: 'EvolutionDuration',
        Value: durationMs,
        Unit: 'Milliseconds',
        Dimensions: dimensions,
      },
    ]).catch((err) => logger.warn('Failed to emit EvolutionOutcome metrics:', err));
  },

  /**
   * Records a tool execution within an evolution context.
   */
  recordToolExecution(
    toolName: string,
    success: boolean,
    durationMs: number,
    scope?: { workspaceId?: string; orgId?: string; teamId?: string; staffId?: string }
  ): void {
    const dimensions = [
      { Name: 'ToolName', Value: toolName },
      { Name: 'Success', Value: String(success) },
    ];
    if (scope?.workspaceId) dimensions.push({ Name: 'WorkspaceId', Value: scope.workspaceId });

    emitMetrics([
      {
        MetricName: 'EvolutionToolExecution',
        Value: 1,
        Unit: 'Count',
        Dimensions: dimensions,
      },
      {
        MetricName: 'EvolutionToolDuration',
        Value: durationMs,
        Unit: 'Milliseconds',
        Dimensions: dimensions,
      },
    ]).catch((err) => logger.warn('Failed to emit EvolutionToolExecution metrics:', err));
  },

  /**
   * Records the ROI (Return on Investment) for a tool execution.
   */
  recordToolROI(
    toolName: string,
    value: number,
    cost: number,
    scope?: { workspaceId?: string; orgId?: string; teamId?: string; staffId?: string }
  ): void {
    const dimensions = [{ Name: 'ToolName', Value: toolName }];
    if (scope?.workspaceId) dimensions.push({ Name: 'WorkspaceId', Value: scope.workspaceId });

    emitMetrics([
      {
        MetricName: 'EvolutionToolValue',
        Value: value,
        Unit: 'Count',
        Dimensions: dimensions,
      },
      {
        MetricName: 'EvolutionToolCost',
        Value: cost,
        Unit: 'Count',
        Dimensions: dimensions,
      },
    ]).catch((err) => logger.warn('Failed to emit EvolutionToolROI metrics:', err));
  },
};
