/**
 * Evolution Budget Module
 *
 * Tracks and enforces cost caps for autonomous evolution cycles.
 * The Strategic Planner checks the budget before dispatching tasks
 * to prevent runaway costs.
 */

import { logger } from './logger';
import { ConfigManager } from './registry/config';

/** Default budget configuration key. */
const BUDGET_KEY = 'evolution_budget';

/** Default budget per cycle (in arbitrary cost units, where 1 unit ≈ $0.01). */
const DEFAULT_BUDGET_PER_CYCLE = 1000;

/** Default cycle duration in milliseconds (48 hours). */
const DEFAULT_CYCLE_DURATION_MS = 48 * 60 * 60 * 1000;

/** Budget configuration stored in ConfigTable. */
export interface EvolutionBudget {
  /** Maximum cost units per cycle. */
  budgetPerCycle: number;
  /** Cost units consumed in the current cycle. */
  spentThisCycle: number;
  /** Start timestamp of the current cycle. */
  cycleStart: number;
  /** Duration of each cycle in milliseconds. */
  cycleDurationMs: number;
}

/**
 * Retrieves the current evolution budget state.
 * If no budget is configured, returns defaults.
 */
export async function getBudget(): Promise<EvolutionBudget> {
  const stored = await ConfigManager.getRawConfig(BUDGET_KEY);

  if (stored && typeof stored === 'object') {
    const budget = stored as EvolutionBudget;
    // Check if cycle has expired
    if (Date.now() - budget.cycleStart > budget.cycleDurationMs) {
      const newBudget: EvolutionBudget = {
        budgetPerCycle: budget.budgetPerCycle,
        spentThisCycle: 0,
        cycleStart: Date.now(),
        cycleDurationMs: budget.cycleDurationMs,
      };
      await saveBudget(newBudget);
      return newBudget;
    }
    return budget;
  }

  // Initialize with defaults
  const defaultBudget: EvolutionBudget = {
    budgetPerCycle: DEFAULT_BUDGET_PER_CYCLE,
    spentThisCycle: 0,
    cycleStart: Date.now(),
    cycleDurationMs: DEFAULT_CYCLE_DURATION_MS,
  };
  await saveBudget(defaultBudget);
  return defaultBudget;
}

/**
 * Saves the budget state to ConfigTable.
 */
async function saveBudget(budget: EvolutionBudget): Promise<void> {
  await ConfigManager.saveRawConfig(BUDGET_KEY, budget);
}

/**
 * Checks if the evolution budget has remaining capacity for a new task.
 *
 * @param estimatedCost - Estimated cost units for the task (default: 10).
 * @returns Object with allowed status and remaining budget info.
 */
export async function canDispatchTask(estimatedCost: number = 10): Promise<{
  allowed: boolean;
  reason?: string;
  remaining: number;
  total: number;
  percentUsed: number;
}> {
  const budget = await getBudget();
  const remaining = budget.budgetPerCycle - budget.spentThisCycle;

  if (remaining < estimatedCost) {
    logger.warn(
      `[EvolutionBudget] Budget exhausted: ${budget.spentThisCycle}/${budget.budgetPerCycle} ` +
        `used. Requested: ${estimatedCost}, Remaining: ${remaining}`
    );
    return {
      allowed: false,
      reason: `Evolution budget exhausted (${budget.spentThisCycle}/${budget.budgetPerCycle} units used). Resets in ${Math.round((budget.cycleStart + budget.cycleDurationMs - Date.now()) / 3600000)}h.`,
      remaining,
      total: budget.budgetPerCycle,
      percentUsed: budget.spentThisCycle / budget.budgetPerCycle,
    };
  }

  return {
    allowed: true,
    remaining: remaining - estimatedCost,
    total: budget.budgetPerCycle,
    percentUsed: budget.spentThisCycle / budget.budgetPerCycle,
  };
}

/**
 * Records cost expenditure against the evolution budget.
 *
 * @param cost - Cost units to deduct.
 */
export async function recordSpend(cost: number): Promise<void> {
  const budget = await getBudget();
  budget.spentThisCycle += cost;
  await saveBudget(budget);

  logger.info(
    `[EvolutionBudget] Recorded spend: ${cost} units. Total: ${budget.spentThisCycle}/${budget.budgetPerCycle} (${((budget.spentThisCycle / budget.budgetPerCycle) * 100).toFixed(1)}%)`
  );
}

/**
 * Updates the budget configuration (admin use).
 *
 * @param budgetPerCycle - New budget limit per cycle.
 * @param cycleDurationMs - Optional new cycle duration.
 */
export async function updateBudgetConfig(
  budgetPerCycle: number,
  cycleDurationMs?: number
): Promise<void> {
  const current = await getBudget();
  const updated: EvolutionBudget = {
    ...current,
    budgetPerCycle,
    cycleDurationMs: cycleDurationMs ?? current.cycleDurationMs,
  };
  await saveBudget(updated);
  logger.info(`[EvolutionBudget] Config updated: ${budgetPerCycle} units per cycle`);
}

/**
 * Gets a human-readable budget status summary.
 */
export async function getBudgetStatus(): Promise<string> {
  const budget = await getBudget();
  const remaining = budget.budgetPerCycle - budget.spentThisCycle;
  const percentUsed = ((budget.spentThisCycle / budget.budgetPerCycle) * 100).toFixed(1);
  const resetsIn = Math.round((budget.cycleStart + budget.cycleDurationMs - Date.now()) / 3600000);

  return (
    `Evolution Budget: ${budget.spentThisCycle}/${budget.budgetPerCycle} units used (${percentUsed}%)\n` +
    `Remaining: ${remaining} units\n` +
    `Resets in: ${resetsIn}h`
  );
}
