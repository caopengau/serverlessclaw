import { logger } from '../../logger';
import { ExecutorOptions, ExecutorUsage, LoopResult } from '../executor-types';
import { estimateCost as calcCost } from '../../providers/pricing';

/**
 * Enforces token and cost budgets during agent execution.
 */
export class BudgetEnforcer {
  /**
   * Checks if the current execution has exceeded its token or cost budget.
   *
   * @param agentId - The ID of the agent being checked.
   * @param options - The execution options containing budget limits.
   * @param currentUsage - The current token usage.
   * @returns A LoopResult if a budget is exceeded or warning threshold reached, null otherwise.
   */
  public static check(
    agentId: string,
    options: ExecutorOptions,
    currentUsage?: ExecutorUsage
  ): LoopResult | null {
    const { tokenBudget, costLimit, activeProvider, activeModel } = options;

    if (!tokenBudget && !costLimit) {
      return null;
    }

    const consumedTokens = currentUsage?.total_tokens ?? 0;
    const SOFT_LIMIT_THRESHOLD = 0.8;

    if (tokenBudget && tokenBudget > 0) {
      const usageRatio = consumedTokens / tokenBudget;

      if (consumedTokens > tokenBudget) {
        logger.warn(`[${agentId}] Token budget exceeded: ${consumedTokens}/${tokenBudget}`);
        return {
          responseText: `[BUDGET_EXCEEDED] Token budget of ${tokenBudget} exceeded. Current usage: ${consumedTokens}. Stopping execution.`,
          paused: false,
          usage: currentUsage,
        };
      }

      if (usageRatio >= SOFT_LIMIT_THRESHOLD) {
        logger.warn(
          `[${agentId}] Token budget at ${Math.round(usageRatio * 100)}%: ${consumedTokens}/${tokenBudget}`
        );
        return {
          responseText: `[BUDGET_WARNING] Token usage at ${Math.round(usageRatio * 100)}% of budget (${consumedTokens}/${tokenBudget}). Wrapping up soon.`,
          paused: false,
          isWarning: true,
          usage: currentUsage,
        };
      }
    }

    if (costLimit && costLimit > 0 && currentUsage) {
      const estimatedCost = this.estimateCost(currentUsage, activeProvider, activeModel);
      const costRatio = estimatedCost / costLimit;

      if (estimatedCost > costLimit) {
        logger.warn(`[${agentId}] Cost limit exceeded: $${estimatedCost.toFixed(4)}/$${costLimit}`);
        return {
          responseText: `[COST_LIMIT_EXCEEDED] Cost limit of $${costLimit.toFixed(2)} exceeded. Estimated: $${estimatedCost.toFixed(2)}. Stopping execution.`,
          paused: false,
          usage: currentUsage,
        };
      }

      if (costRatio >= SOFT_LIMIT_THRESHOLD) {
        logger.warn(
          `[${agentId}] Cost at ${Math.round(costRatio * 100)}%: $${estimatedCost.toFixed(4)}/$${costLimit}`
        );
        return {
          responseText: `[COST_WARNING] Cost at ${Math.round(costRatio * 100)}% of limit ($${estimatedCost.toFixed(2)}/$${costLimit.toFixed(2)}). Wrapping up soon.`,
          paused: false,
          isWarning: true,
          usage: currentUsage,
        };
      }
    }

    return null;
  }

  /**
   * Estimates the monetary cost of the current execution.
   */
  public static estimateCost(usage: ExecutorUsage, provider?: string, model?: string): number {
    return calcCost(usage.totalInputTokens, usage.totalOutputTokens, provider, model);
  }
}
