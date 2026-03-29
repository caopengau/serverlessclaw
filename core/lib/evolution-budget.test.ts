import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionBudgetManager } from './evolution-budget';
import { ConfigManager } from './registry/config';

vi.mock('./registry/config', () => ({
  ConfigManager: {
    getRawConfig: vi.fn(),
    saveRawConfig: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('./logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('EvolutionBudgetManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('canDispatchTask', () => {
    it('should return true if budget has remaining funds', async () => {
      vi.mocked(ConfigManager.getRawConfig).mockImplementation(async (key) => {
        if (key === 'evolution_budget')
          return {
            maxSpend: 10.0,
            currentSpend: 5.0,
            expiresAt: Date.now() + 100000,
          };
        return null;
      });

      const result = await EvolutionBudgetManager.canDispatchTask(1.0);
      expect(result).toBe(true);
    });

    it('should return false if budget is exceeded', async () => {
      vi.mocked(ConfigManager.getRawConfig).mockImplementation(async (key) => {
        if (key === 'evolution_budget')
          return {
            maxSpend: 10.0,
            currentSpend: 9.5,
            expiresAt: Date.now() + 100000,
          };
        return null;
      });

      const result = await EvolutionBudgetManager.canDispatchTask(1.0);
      expect(result).toBe(false);
    });
  });

  describe('recordSpend', () => {
    it('should increment currentSpend and save config', async () => {
      const mockBudget = {
        maxSpend: 10.0,
        currentSpend: 2.0,
        expiresAt: Date.now() + 100000,
      };
      vi.mocked(ConfigManager.getRawConfig).mockResolvedValue(mockBudget);

      await EvolutionBudgetManager.recordSpend(0.5);

      expect(ConfigManager.saveRawConfig).toHaveBeenCalledWith(
        'evolution_budget',
        expect.objectContaining({ currentSpend: 2.5 })
      );
    });
  });
});
