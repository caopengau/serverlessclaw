/**
 * @module TrackBudgetAllocator
 * @description Track-aware budget allocation for multi-track evolution.
 * Distributes evolution budget across tracks based on priority and weights,
 * with dynamic rebalancing based on track performance.
 */

import { EvolutionTrack } from '../types/agent';
import { logger } from '../logger';
import { TIME } from '../constants';

/**
 * Budget allocation for a single track.
 */
export interface TrackBudgetAllocation {
  track: EvolutionTrack;
  allocatedUsd: number;
  spentUsd: number;
  remainingUsd: number;
  utilizationRate: number;
  priority: number;
}

/**
 * Budget cycle configuration.
 */
export interface BudgetCycleConfig {
  /** Total budget per cycle in USD. */
  totalBudgetUsd: number;
  /** Cycle duration in days. */
  cycleDays: number;
  /** Enable dynamic rebalancing based on performance. */
  enableDynamicRebalancing: boolean;
  /** Minimum budget allocation per track (floor). */
  minAllocationUsd: number;
  /** Maximum budget allocation per track (ceiling). */
  maxAllocationUsd: number;
}

/**
 * Budget spend record.
 */
export interface BudgetSpendRecord {
  track: EvolutionTrack;
  gapId: string;
  spendUsd: number;
  timestamp: number;
  agentId: string;
}

const DEFAULT_CYCLE_CONFIG: BudgetCycleConfig = {
  totalBudgetUsd: 10.0,
  cycleDays: 7,
  enableDynamicRebalancing: true,
  minAllocationUsd: 0.5,
  maxAllocationUsd: 5.0,
};

/**
 * Default budget weights by track priority.
 */
const DEFAULT_BUDGET_WEIGHTS: Record<EvolutionTrack, number> = {
  [EvolutionTrack.SECURITY]: 0.3, // Highest priority
  [EvolutionTrack.PERFORMANCE]: 0.25,
  [EvolutionTrack.FEATURE]: 0.2,
  [EvolutionTrack.INFRASTRUCTURE]: 0.15,
  [EvolutionTrack.REFACTORING]: 0.1, // Lowest priority
};

/**
 * Allocates and tracks budget across evolution tracks.
 */
export class TrackBudgetAllocator {
  private config: BudgetCycleConfig;
  private allocations: Map<EvolutionTrack, TrackBudgetAllocation> = new Map();
  private spendHistory: BudgetSpendRecord[] = [];
  private cycleStartTime: number;
  private weights: Record<EvolutionTrack, number>;

  constructor(
    config?: Partial<BudgetCycleConfig>,
    weights?: Partial<Record<EvolutionTrack, number>>
  ) {
    this.config = { ...DEFAULT_CYCLE_CONFIG, ...config };
    this.weights = { ...DEFAULT_BUDGET_WEIGHTS, ...weights };
    this.cycleStartTime = Date.now();

    // Initialize allocations
    this.initializeAllocations();

    logger.info('TrackBudgetAllocator initialized', {
      totalBudget: this.config.totalBudgetUsd,
      cycleDays: this.config.cycleDays,
      dynamicRebalancing: this.config.enableDynamicRebalancing,
    });
  }

  /**
   * Initialize budget allocations based on weights.
   */
  private initializeAllocations(): void {
    const tracks = Object.values(EvolutionTrack);
    const totalWeight = tracks.reduce((sum, t) => sum + (this.weights[t] ?? 0), 0);

    for (const track of tracks) {
      const weight = this.weights[track] ?? 0;
      const rawAllocation = (weight / totalWeight) * this.config.totalBudgetUsd;

      // Apply floor and ceiling
      const allocation = Math.max(
        this.config.minAllocationUsd,
        Math.min(this.config.maxAllocationUsd, rawAllocation)
      );

      this.allocations.set(track, {
        track,
        allocatedUsd: allocation,
        spentUsd: 0,
        remainingUsd: allocation,
        utilizationRate: 0,
        priority: this.getTrackPriority(track),
      });
    }
  }

  /**
   * Get numeric priority for a track (lower = higher priority).
   */
  private getTrackPriority(track: EvolutionTrack): number {
    const priorities: Record<EvolutionTrack, number> = {
      [EvolutionTrack.SECURITY]: 1,
      [EvolutionTrack.PERFORMANCE]: 2,
      [EvolutionTrack.FEATURE]: 3,
      [EvolutionTrack.INFRASTRUCTURE]: 4,
      [EvolutionTrack.REFACTORING]: 5,
    };
    return priorities[track] ?? 5;
  }

  /**
   * Check if a spend is allowed for a track.
   */
  canSpend(track: EvolutionTrack, amountUsd: number): boolean {
    const allocation = this.allocations.get(track);
    if (!allocation) return false;

    return allocation.remainingUsd >= amountUsd;
  }

  /**
   * Record a spend against a track's budget.
   */
  recordSpend(track: EvolutionTrack, gapId: string, spendUsd: number, agentId: string): boolean {
    if (!this.canSpend(track, spendUsd)) {
      logger.warn(`Budget exceeded for track ${track}: ${spendUsd} USD requested`);
      return false;
    }

    const allocation = this.allocations.get(track)!;
    allocation.spentUsd += spendUsd;
    allocation.remainingUsd -= spendUsd;
    allocation.utilizationRate = allocation.spentUsd / allocation.allocatedUsd;

    // Record spend history
    this.spendHistory.push({
      track,
      gapId,
      spendUsd,
      timestamp: Date.now(),
      agentId,
    });

    // Trim history to last 1000 records
    if (this.spendHistory.length > 1000) {
      this.spendHistory = this.spendHistory.slice(-1000);
    }

    logger.debug(`Budget spend recorded: ${track} - $${spendUsd.toFixed(4)} for gap ${gapId}`);
    return true;
  }

  /**
   * Get allocation for a specific track.
   */
  getAllocation(track: EvolutionTrack): TrackBudgetAllocation | undefined {
    return this.allocations.get(track);
  }

  /**
   * Get all allocations.
   */
  getAllAllocations(): TrackBudgetAllocation[] {
    return Array.from(this.allocations.values());
  }

  /**
   * Get total budget remaining across all tracks.
   */
  getTotalRemaining(): number {
    let total = 0;
    for (const allocation of this.allocations.values()) {
      total += allocation.remainingUsd;
    }
    return total;
  }

  /**
   * Get total budget spent across all tracks.
   */
  getTotalSpent(): number {
    let total = 0;
    for (const allocation of this.allocations.values()) {
      total += allocation.spentUsd;
    }
    return total;
  }

  /**
   * Get budget utilization across all tracks.
   */
  getOverallUtilization(): number {
    const totalAllocated = this.config.totalBudgetUsd;
    const totalSpent = this.getTotalSpent();
    return totalAllocated > 0 ? totalSpent / totalAllocated : 0;
  }

  /**
   * Rebalance budgets based on track performance.
   * Takes budget from underperforming tracks and gives to high-performing ones.
   */
  rebalanceBasedOnPerformance(
    trackPerformance: Map<EvolutionTrack, { successRate: number; utilizationRate: number }>
  ): void {
    if (!this.config.enableDynamicRebalancing) return;

    const tracks = Array.from(this.allocations.values());
    const underperforming: TrackBudgetAllocation[] = [];
    const highPerforming: TrackBudgetAllocation[] = [];

    // Categorize tracks
    for (const allocation of tracks) {
      const perf = trackPerformance.get(allocation.track);
      if (!perf) continue;

      if (perf.successRate < 0.5 && allocation.utilizationRate > 0.8) {
        // Underperforming and using budget inefficiently
        underperforming.push(allocation);
      } else if (perf.successRate > 0.8 && allocation.utilizationRate > 0.5) {
        // High performing and actively using budget
        highPerforming.push(allocation);
      }
    }

    // Redistribute budget
    if (underperforming.length > 0 && highPerforming.length > 0) {
      let freedBudget = 0;

      for (const allocation of underperforming) {
        // Take 20% of remaining budget from underperforming tracks
        const reduction = allocation.remainingUsd * 0.2;
        allocation.allocatedUsd -= reduction;
        allocation.remainingUsd -= reduction;
        freedBudget += reduction;
        logger.info(`Reduced budget for track ${allocation.track} by $${reduction.toFixed(4)}`);
      }

      // Distribute freed budget to high-performing tracks
      const perTrackIncrease = freedBudget / highPerforming.length;
      for (const allocation of highPerforming) {
        const increase = Math.min(
          perTrackIncrease,
          this.config.maxAllocationUsd - allocation.allocatedUsd
        );
        allocation.allocatedUsd += increase;
        allocation.remainingUsd += increase;
        logger.info(`Increased budget for track ${allocation.track} by $${increase.toFixed(4)}`);
      }
    }
  }

  /**
   * Reset the budget cycle.
   */
  resetCycle(): void {
    this.cycleStartTime = Date.now();
    this.spendHistory = [];
    this.initializeAllocations();
    logger.info('Budget cycle reset');
  }

  /**
   * Get cycle progress (0-1).
   */
  getCycleProgress(): number {
    const elapsed = Date.now() - this.cycleStartTime;
    const totalCycleMs = this.config.cycleDays * TIME.MS_PER_DAY;
    return Math.min(1, elapsed / totalCycleMs);
  }

  /**
   * Get time remaining in current cycle (ms).
   */
  getCycleTimeRemainingMs(): number {
    const elapsed = Date.now() - this.cycleStartTime;
    const totalCycleMs = this.config.cycleDays * TIME.MS_PER_DAY;
    return Math.max(0, totalCycleMs - elapsed);
  }

  /**
   * Get spend history for a track.
   */
  getSpendHistory(track: EvolutionTrack, limit: number = 100): BudgetSpendRecord[] {
    return this.spendHistory.filter((record) => record.track === track).slice(-limit);
  }

  /**
   * Get budget summary.
   */
  getSummary(): {
    totalBudget: number;
    totalSpent: number;
    totalRemaining: number;
    utilization: number;
    cycleProgress: number;
    cycleDaysRemaining: number;
    allocations: TrackBudgetAllocation[];
  } {
    return {
      totalBudget: this.config.totalBudgetUsd,
      totalSpent: this.getTotalSpent(),
      totalRemaining: this.getTotalRemaining(),
      utilization: this.getOverallUtilization(),
      cycleProgress: this.getCycleProgress(),
      cycleDaysRemaining: Math.ceil(this.getCycleTimeRemainingMs() / TIME.MS_PER_DAY),
      allocations: this.getAllAllocations(),
    };
  }
}
