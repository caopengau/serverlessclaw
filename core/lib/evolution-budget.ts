import { ConfigManager } from './registry/config';
import { logger } from './logger';

export interface EvolutionBudget {
  cycleId: string; // e.g., '2026-W13'
  maxSpend: number; // in USD
  currentSpend: number;
  expiresAt: number;
}

/**
 * EvolutionBudgetManager enforces cost guardrails for the autonomous swarm.
 */
export class EvolutionBudgetManager {
  private static readonly BUDGET_KEY = 'evolution_budget';

  /**
   * Checks if a new task can be dispatched within the current budget.
   * @param estimatedCost Estimated cost of the task in USD.
   */
  static async canDispatchTask(estimatedCost: number): Promise<boolean> {
    const budget = await this.getOrCreateBudget();

    if (budget.currentSpend + estimatedCost > budget.maxSpend) {
      logger.warn(
        `[Budget] Evolution budget exceeded. Current: ${budget.currentSpend}, Request: ${estimatedCost}, Max: ${budget.maxSpend}`
      );
      return false;
    }

    return true;
  }

  /**
   * Records the actual spend for a completed task.
   */
  static async recordSpend(amount: number): Promise<void> {
    const budget = await this.getOrCreateBudget();
    budget.currentSpend += amount;
    await ConfigManager.saveRawConfig(this.BUDGET_KEY, budget);
    logger.info(
      `[Budget] Recorded spend: $${amount.toFixed(4)}. Total Cycle Spend: $${budget.currentSpend.toFixed(4)}`
    );
  }

  private static async getOrCreateBudget(): Promise<EvolutionBudget> {
    const now = Date.now();
    let budget = (await ConfigManager.getRawConfig(this.BUDGET_KEY)) as EvolutionBudget;

    // Reset budget if cycle expired (default 7 days)
    if (!budget || now > budget.expiresAt) {
      const cycleId = new Date().toISOString().slice(0, 10);
      budget = {
        cycleId,
        maxSpend: ((await ConfigManager.getRawConfig('max_evolution_spend_usd')) as number) ?? 10.0,
        currentSpend: 0,
        expiresAt: now + 7 * 24 * 60 * 60 * 1000,
      };
      await ConfigManager.saveRawConfig(this.BUDGET_KEY, budget);
      logger.info(`[Budget] New evolution cycle started: ${cycleId}`);
    }

    return budget;
  }
}
