import { ToolResult } from '../../types/index';
import { logger } from '../../logger';

/**
 * Checks if a tool execution was successful based on its result and text output.
 */
export function isToolExecutionSuccessful(
  rawResult: ToolResult | string,
  resultText: string
): boolean {
  if (resultText.startsWith('FAILED')) return false;
  if (typeof rawResult === 'object' && rawResult !== null) {
    const res = rawResult as any;
    if (res.success === false) return false;
    if (res.error) return false;
    if (res.status === 'error' || res.status === 'failed') return false;
  }
  return true;
}

/**
 * Records analytics and trust score updates for tool execution.
 */
export async function recordToolAnalytics(
  toolName: string,
  agentId: string,
  success: boolean,
  durationMs: number,
  args: Record<string, unknown>,
  resultText: string,
  execContext: any
): Promise<void> {
  if (process.env.VITEST) return;

  try {
    const { AgentRegistry } = await import('../../registry');
    await AgentRegistry.recordToolUsage(toolName, agentId, {
      workspaceId: execContext.workspaceId,
      teamId: execContext.teamId,
      staffId: execContext.staffId,
    });

    const { TrustManager } = await import('../../safety/trust-manager');
    const trustContext = {
      workspaceId: execContext.workspaceId,
      teamId: execContext.teamId,
      staffId: execContext.staffId,
    };

    if (success) {
      await TrustManager.recordSuccess(agentId, 10, trustContext);
    } else {
      await TrustManager.recordFailure(
        agentId,
        `Tool ${toolName} execution failed.`,
        1,
        0,
        trustContext
      );
    }

    const { emitMetrics, METRICS } = await import('../../metrics');
    const scope = {
      workspaceId: execContext.workspaceId,
      teamId: execContext.teamId,
      staffId: execContext.staffId,
    };
    emitMetrics([METRICS.toolExecuted(toolName, success, scope)]).catch(() => {});
    emitMetrics([METRICS.toolDuration(toolName, Math.round(durationMs), scope)]).catch(() => {});

    const estimatedInputTokens = Math.ceil(JSON.stringify(args).length / 4);
    const estimatedOutputTokens = Math.ceil(resultText.length / 4);

    const { TokenTracker } = await import('../../metrics/token-usage');
    TokenTracker.updateToolRollup(
      toolName,
      success,
      Math.round(durationMs),
      estimatedInputTokens,
      estimatedOutputTokens,
      scope
    ).catch(() => {});

    const { EVOLUTION_METRICS } = await import('../../metrics/evolution-metrics');
    const analyticsScope = {
      workspaceId: execContext.workspaceId,
      orgId: execContext.orgId,
      teamId: execContext.teamId,
      staffId: execContext.staffId,
    };
    EVOLUTION_METRICS.recordToolExecution(
      toolName,
      success,
      Math.round(durationMs),
      analyticsScope
    );
    EVOLUTION_METRICS.recordToolROI(
      toolName,
      success ? 1.0 : 0.0,
      estimatedInputTokens + estimatedOutputTokens,
      analyticsScope
    );
  } catch (error) {
    logger.error(`[ANALYTICS] Failed to record tool usage for ${toolName}:`, error);
  }
}
