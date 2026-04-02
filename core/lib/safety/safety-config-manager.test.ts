/**
 * @module SafetyConfigManager Tests
 * @description Tests for safety policy management including DDB fetching,
 * caching, cache invalidation, and fallback to defaults.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SafetyConfigManager } from './safety-config-manager';
import { SafetyTier } from '../types/agent';
import { DEFAULT_POLICIES } from './safety-config';

const mockGetRawConfig = vi.fn();
const mockSaveRawConfig = vi.fn();

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../registry/config', () => ({
  ConfigManager: {
    getRawConfig: (...args: unknown[]) => mockGetRawConfig(...args),
    saveRawConfig: (...args: unknown[]) => mockSaveRawConfig(...args),
  },
}));

vi.mock('../constants', () => ({
  TIME: { MS_PER_MINUTE: 60000 },
  PROTECTED_FILES: [
    '.git',
    '.env',
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'node_modules',
  ],
}));

describe('SafetyConfigManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    SafetyConfigManager.clearCache();
  });

  describe('getPolicies', () => {
    it('returns DDB policies merged with defaults', async () => {
      mockGetRawConfig.mockResolvedValue({
        [SafetyTier.SANDBOX]: {
          ...DEFAULT_POLICIES[SafetyTier.SANDBOX],
          maxDeploymentsPerDay: 5,
        },
      });

      const policies = await SafetyConfigManager.getPolicies();

      expect(policies[SafetyTier.SANDBOX].maxDeploymentsPerDay).toBe(5);
      expect(policies[SafetyTier.AUTONOMOUS]).toEqual(DEFAULT_POLICIES[SafetyTier.AUTONOMOUS]);
    });

    it('returns cached policies on subsequent calls within TTL', async () => {
      mockGetRawConfig.mockResolvedValue(DEFAULT_POLICIES);

      await SafetyConfigManager.getPolicies();
      await SafetyConfigManager.getPolicies();

      expect(mockGetRawConfig).toHaveBeenCalledTimes(1);
    });

    it('refetches after cache expires', async () => {
      mockGetRawConfig.mockResolvedValue(DEFAULT_POLICIES);

      await SafetyConfigManager.getPolicies();
      SafetyConfigManager.clearCache();
      await SafetyConfigManager.getPolicies();

      expect(mockGetRawConfig).toHaveBeenCalledTimes(2);
    });

    it('falls back to DEFAULT_POLICIES when DDB returns non-object', async () => {
      mockGetRawConfig.mockResolvedValue('invalid');

      const policies = await SafetyConfigManager.getPolicies();

      expect(policies).toEqual(DEFAULT_POLICIES);
    });

    it('falls back to DEFAULT_POLICIES when DDB returns null', async () => {
      mockGetRawConfig.mockResolvedValue(null);

      const policies = await SafetyConfigManager.getPolicies();

      expect(policies).toEqual(DEFAULT_POLICIES);
    });

    it('falls back to DEFAULT_POLICIES on DDB error', async () => {
      mockGetRawConfig.mockRejectedValue(new Error('DDB down'));

      const policies = await SafetyConfigManager.getPolicies();

      expect(policies).toEqual(DEFAULT_POLICIES);
      const { logger } = await import('../logger');
      expect(logger.warn).toHaveBeenCalled();
    });

    it('ignores invalid tier keys in DDB data', async () => {
      mockGetRawConfig.mockResolvedValue({
        invalid_tier: { requireCodeApproval: true },
      });

      const policies = await SafetyConfigManager.getPolicies();

      expect(policies[SafetyTier.SANDBOX]).toEqual(DEFAULT_POLICIES[SafetyTier.SANDBOX]);
      expect(policies[SafetyTier.AUTONOMOUS]).toEqual(DEFAULT_POLICIES[SafetyTier.AUTONOMOUS]);
    });
  });

  describe('getPolicy', () => {
    it('returns policy for specific tier', async () => {
      mockGetRawConfig.mockResolvedValue(DEFAULT_POLICIES);

      const policy = await SafetyConfigManager.getPolicy(SafetyTier.SANDBOX);

      expect(policy.tier).toBe(SafetyTier.SANDBOX);
    });

    it('falls back to default for missing tier', async () => {
      mockGetRawConfig.mockResolvedValue({});

      const policy = await SafetyConfigManager.getPolicy(SafetyTier.SANDBOX);

      expect(policy).toEqual(DEFAULT_POLICIES[SafetyTier.SANDBOX]);
    });
  });

  describe('savePolicies', () => {
    it('merges partial policies with current and saves', async () => {
      mockGetRawConfig.mockResolvedValue(DEFAULT_POLICIES);
      mockSaveRawConfig.mockResolvedValue(undefined);

      await SafetyConfigManager.savePolicies({
        [SafetyTier.SANDBOX]: { maxDeploymentsPerDay: 10 },
      });

      expect(mockSaveRawConfig).toHaveBeenCalledTimes(1);
      const savedPolicies = mockSaveRawConfig.mock.calls[0][1];
      expect(savedPolicies[SafetyTier.SANDBOX].maxDeploymentsPerDay).toBe(10);
    });

    it('invalidates cache after save', async () => {
      mockGetRawConfig.mockResolvedValue(DEFAULT_POLICIES);
      mockSaveRawConfig.mockResolvedValue(undefined);

      await SafetyConfigManager.getPolicies();
      await SafetyConfigManager.savePolicies({
        [SafetyTier.SANDBOX]: { maxDeploymentsPerDay: 10 },
      });
      await SafetyConfigManager.getPolicies();

      expect(mockGetRawConfig).toHaveBeenCalledTimes(2);
    });

    it('ignores invalid tier keys', async () => {
      mockGetRawConfig.mockResolvedValue(DEFAULT_POLICIES);
      mockSaveRawConfig.mockResolvedValue(undefined);

      await SafetyConfigManager.savePolicies({
        invalid_tier: { requireCodeApproval: true },
      });

      const savedPolicies = mockSaveRawConfig.mock.calls[0][1];
      expect(savedPolicies).not.toHaveProperty('invalid_tier');
    });
  });

  describe('clearCache', () => {
    it('forces next getPolicies to fetch from DDB', async () => {
      mockGetRawConfig.mockResolvedValue(DEFAULT_POLICIES);

      await SafetyConfigManager.getPolicies();
      expect(mockGetRawConfig).toHaveBeenCalledTimes(1);

      SafetyConfigManager.clearCache();
      await SafetyConfigManager.getPolicies();
      expect(mockGetRawConfig).toHaveBeenCalledTimes(2);
    });
  });
});
