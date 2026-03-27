/**
 * Tiering / RetentionManager Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetentionManager, RetentionTiers } from './tiering';

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../registry', () => ({
  AgentRegistry: {
    getRetentionDays: vi.fn().mockResolvedValue(30),
  },
}));

vi.mock('../circuit-breaker', () => ({
  getCircuitBreaker: vi.fn().mockReturnValue({
    reset: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe('RetentionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getExpiresAt', () => {
    it('should return STANDARD tier for MESSAGES', async () => {
      const { AgentRegistry } = await import('../registry');
      (AgentRegistry.getRetentionDays as ReturnType<typeof vi.fn>).mockResolvedValue(30);

      const result = await RetentionManager.getExpiresAt('MESSAGES', 'user123');

      expect(result.type).toBe('msg');
      expect(result.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(AgentRegistry.getRetentionDays).toHaveBeenCalledWith('MESSAGES_DAYS');
    });

    it('should return CRITICAL tier for LESSONS', async () => {
      const { AgentRegistry } = await import('../registry');
      (AgentRegistry.getRetentionDays as ReturnType<typeof vi.fn>).mockResolvedValue(365);

      const result = await RetentionManager.getExpiresAt('LESSONS', 'user123');

      expect(result.type).toBe('LESSON');
      expect(AgentRegistry.getRetentionDays).toHaveBeenCalledWith('LESSONS_DAYS');
    });

    it('should return CRITICAL tier for LESSON (singular)', async () => {
      const { AgentRegistry } = await import('../registry');

      await RetentionManager.getExpiresAt('LESSON', 'user123');

      expect(AgentRegistry.getRetentionDays).toHaveBeenCalledWith('LESSONS_DAYS');
    });

    it('should return CRITICAL tier for MEMORY', async () => {
      const { AgentRegistry } = await import('../registry');

      await RetentionManager.getExpiresAt('MEMORY', 'user123');

      expect(AgentRegistry.getRetentionDays).toHaveBeenCalledWith('LESSONS_DAYS');
    });

    it('should return TRAILS tier for TRACES', async () => {
      const { AgentRegistry } = await import('../registry');

      const result = await RetentionManager.getExpiresAt('TRACES', 'user123');

      expect(result.type).toBe('trace');
      expect(AgentRegistry.getRetentionDays).toHaveBeenCalledWith('TRACES_DAYS');
    });

    it('should return EPHEMERAL tier for TEMP# userId', async () => {
      const { AgentRegistry } = await import('../registry');

      const result = await RetentionManager.getExpiresAt('SESSIONS', 'TEMP#session123');

      expect(result.type).toBe('temp');
      expect(AgentRegistry.getRetentionDays).toHaveBeenCalledWith('SESSIONS_DAYS');
    });

    it('should return EPHEMERAL tier for EPHEMERAL category', async () => {
      const { AgentRegistry } = await import('../registry');

      const result = await RetentionManager.getExpiresAt('EPHEMERAL', 'user123');

      expect(result.type).toBe('temp');
      expect(AgentRegistry.getRetentionDays).toHaveBeenCalledWith('SESSIONS_DAYS');
    });

    it('should calculate expiresAt correctly', async () => {
      const { AgentRegistry } = await import('../registry');
      (AgentRegistry.getRetentionDays as ReturnType<typeof vi.fn>).mockResolvedValue(30);

      const before = Date.now();
      const result = await RetentionManager.getExpiresAt('MESSAGES', 'user123');
      const after = Date.now();

      const expectedMin = Math.floor(before / 1000) + 30 * 86400;
      const expectedMax = Math.floor(after / 1000) + 30 * 86400;

      expect(result.expiresAt).toBeGreaterThanOrEqual(expectedMin);
      expect(result.expiresAt).toBeLessThanOrEqual(expectedMax);
    });

    it('should default userId to empty string', async () => {
      const result = await RetentionManager.getExpiresAt('MESSAGES');

      expect(result.type).toBe('msg');
    });
  });

  describe('performSystemCleanup', () => {
    it('should reset circuit breaker', async () => {
      const { getCircuitBreaker } = await import('../circuit-breaker');
      const mockReset = vi.fn().mockResolvedValue(undefined);
      (getCircuitBreaker as ReturnType<typeof vi.fn>).mockReturnValue({ reset: mockReset });

      await RetentionManager.performSystemCleanup();

      expect(mockReset).toHaveBeenCalled();
    });

    it('should handle circuit breaker reset failure gracefully', async () => {
      const { getCircuitBreaker } = await import('../circuit-breaker');
      const mockReset = vi.fn().mockRejectedValue(new Error('Reset failed'));
      (getCircuitBreaker as ReturnType<typeof vi.fn>).mockReturnValue({ reset: mockReset });

      await expect(RetentionManager.performSystemCleanup()).resolves.not.toThrow();
    });
  });

  describe('RetentionTiers enum', () => {
    it('should have correct values', () => {
      expect(RetentionTiers.STANDARD).toBe('MESSAGES_DAYS');
      expect(RetentionTiers.CRITICAL).toBe('LESSONS_DAYS');
      expect(RetentionTiers.EPHEMERAL).toBe('SESSIONS_DAYS');
      expect(RetentionTiers.TRAILS).toBe('TRACES_DAYS');
    });
  });
});
