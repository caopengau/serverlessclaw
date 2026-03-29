import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  canDispatchTask,
  recordSpend,
  getBudgetStatus,
  updateBudgetConfig,
} from './evolution-budget';

const mockGetRawConfig = vi.fn();
const mockSaveRawConfig = vi.fn();

vi.mock('./registry/config', () => ({
  ConfigManager: {
    getRawConfig: (...args: unknown[]) => mockGetRawConfig(...args),
    saveRawConfig: (...args: unknown[]) => mockSaveRawConfig(...args),
  },
}));

vi.mock('./logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Evolution Budget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveRawConfig.mockResolvedValue(undefined);
  });

  describe('canDispatchTask', () => {
    it('should allow dispatch when budget is available', async () => {
      mockGetRawConfig.mockResolvedValue({
        budgetPerCycle: 1000,
        spentThisCycle: 100,
        cycleStart: Date.now() - 1000,
        cycleDurationMs: 48 * 3600 * 1000,
      });

      const result = await canDispatchTask(50);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(850);
    });

    it('should reject dispatch when budget is exhausted', async () => {
      mockGetRawConfig.mockResolvedValue({
        budgetPerCycle: 100,
        spentThisCycle: 99,
        cycleStart: Date.now() - 1000,
        cycleDurationMs: 48 * 3600 * 1000,
      });

      const result = await canDispatchTask(50);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('budget exhausted');
    });

    it('should initialize with defaults when no config exists', async () => {
      mockGetRawConfig.mockResolvedValue(undefined);

      const result = await canDispatchTask(10);
      expect(result.allowed).toBe(true);
      expect(result.total).toBe(1000);
    });

    it('should reset spentThisCycle when cycle has expired', async () => {
      const oldCycleStart = Date.now() - 72 * 3600 * 1000; // 72 hours ago
      mockGetRawConfig.mockResolvedValue({
        budgetPerCycle: 100,
        spentThisCycle: 100, // exhausted in old cycle
        cycleStart: oldCycleStart,
        cycleDurationMs: 48 * 3600 * 1000, // 48h cycle
      });

      const result = await canDispatchTask(10);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(90); // reset to fresh
    });
  });

  describe('recordSpend', () => {
    it('should accumulate spend against the budget', async () => {
      mockGetRawConfig.mockResolvedValue({
        budgetPerCycle: 1000,
        spentThisCycle: 100,
        cycleStart: Date.now() - 1000,
        cycleDurationMs: 48 * 3600 * 1000,
      });

      await recordSpend(25);

      expect(mockSaveRawConfig).toHaveBeenCalledWith(
        'evolution_budget',
        expect.objectContaining({
          spentThisCycle: 125,
        })
      );
    });
  });

  describe('updateBudgetConfig', () => {
    it('should update budget per cycle', async () => {
      mockGetRawConfig.mockResolvedValue({
        budgetPerCycle: 1000,
        spentThisCycle: 0,
        cycleStart: Date.now(),
        cycleDurationMs: 48 * 3600 * 1000,
      });

      await updateBudgetConfig(2000);

      expect(mockSaveRawConfig).toHaveBeenCalledWith(
        'evolution_budget',
        expect.objectContaining({
          budgetPerCycle: 2000,
        })
      );
    });
  });

  describe('getBudgetStatus', () => {
    it('should return a human-readable summary', async () => {
      mockGetRawConfig.mockResolvedValue({
        budgetPerCycle: 1000,
        spentThisCycle: 250,
        cycleStart: Date.now() - 12 * 3600 * 1000,
        cycleDurationMs: 48 * 3600 * 1000,
      });

      const status = await getBudgetStatus();
      expect(status).toContain('250/1000');
      expect(status).toContain('25.0%');
      expect(status).toContain('Remaining: 750');
    });
  });
});
