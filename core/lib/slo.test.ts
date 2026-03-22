import { describe, it, expect } from 'vitest';
import { SLOTracker } from './slo';
import { TokenRollup } from './token-usage';

describe('SLOTracker', () => {
  const mockRollups: TokenRollup[] = [
    {
      userId: 'TOKEN_ROLLUP#coder#2026-03-20',
      timestamp: 1710892800000,
      totalInputTokens: 10000,
      totalOutputTokens: 5000,
      invocationCount: 100,
      toolCalls: 50,
      avgTokensPerInvocation: 150,
      successCount: 97,
      expiresAt: 0,
    },
    {
      userId: 'TOKEN_ROLLUP#coder#2026-03-21',
      timestamp: 1710979200000,
      totalInputTokens: 12000,
      totalOutputTokens: 6000,
      invocationCount: 120,
      toolCalls: 60,
      avgTokensPerInvocation: 150,
      successCount: 115,
      expiresAt: 0,
    },
  ];

  describe('checkSLO', () => {
    it('should report within budget when success rate meets target', async () => {
      const slo = {
        name: 'test',
        target: 0.95,
        window: 'daily' as const,
        metric: 'task_success_rate' as const,
      };
      const result = await SLOTracker.checkSLO(slo, mockRollups);
      // 212 successes / 220 total = 0.9636, target 0.95 → within budget
      expect(result.withinBudget).toBe(true);
      expect(result.burnRate).toBeLessThan(1);
    });

    it('should report out of budget when success rate is below target', async () => {
      const slo = {
        name: 'test',
        target: 0.99,
        window: 'daily' as const,
        metric: 'task_success_rate' as const,
      };
      const result = await SLOTracker.checkSLO(slo, mockRollups);
      // 212/220 = 0.9636, target 0.99 → out of budget
      expect(result.withinBudget).toBe(false);
    });

    it('should return 0 burn rate with no rollups', async () => {
      const slo = {
        name: 'test',
        target: 0.95,
        window: 'daily' as const,
        metric: 'task_success_rate' as const,
      };
      const result = await SLOTracker.checkSLO(slo, []);
      expect(result.burnRate).toBe(0);
      expect(result.withinBudget).toBe(true);
    });
  });

  describe('getSLODefinitions', () => {
    it('should return default SLO definitions', () => {
      const defs = SLOTracker.getSLODefinitions();
      expect(defs).toHaveLength(3);
      expect(defs.map((d) => d.name)).toContain('task_success_rate');
    });
  });
});
