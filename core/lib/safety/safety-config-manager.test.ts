/**
 * @module SafetyConfigManager Tests
 * @description Tests for safety policy management including DDB fetching,
 * caching, cache invalidation, and fallback to defaults.\n */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SafetyConfigManager } from './safety-config-manager';
import { SafetyTier } from '../types/agent';
import { DEFAULT_POLICIES } from './safety-config';
import { ConfigManager } from '../registry/config';

// Mock ConfigManager
vi.mock('../registry/config', () => ({
  ConfigManager: {
    getRawConfig: vi.fn(),
    saveRawConfig: vi.fn(),
  },
}));

// Mock logger
vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('SafetyConfigManager', () => {
  const mockGetRawConfig = ConfigManager.getRawConfig as any;
  const mockSaveRawConfig = ConfigManager.saveRawConfig as any;

  beforeEach(() => {
    vi.clearAllMocks();
    SafetyConfigManager.clearCache();
  });

  describe('getPolicies', () => {
    it('returns DDB policies merged with defaults', async () => {
      mockGetRawConfig.mockResolvedValue({
        [SafetyTier.PROD]: {
          ...DEFAULT_POLICIES[SafetyTier.PROD],
          maxDeploymentsPerDay: 5,
        },
      });

      const policies = await SafetyConfigManager.getPolicies();

      expect(policies[SafetyTier.PROD].maxDeploymentsPerDay).toBe(5);
      expect(policies[SafetyTier.LOCAL]).toEqual(DEFAULT_POLICIES[SafetyTier.LOCAL]);
    });

    it('returns cached policies on subsequent calls within TTL', async () => {
      mockGetRawConfig.mockResolvedValue(DEFAULT_POLICIES);

      await SafetyConfigManager.getPolicies();
      await SafetyConfigManager.getPolicies();

      expect(mockGetRawConfig).toHaveBeenCalledTimes(1);
    });

    it('falls back to defaults if DDB returns nothing', async () => {
      mockGetRawConfig.mockResolvedValue(null);

      const policies = await SafetyConfigManager.getPolicies();

      expect(policies).toEqual(DEFAULT_POLICIES);
    });

    it('ignores invalid tier keys in DDB data', async () => {
      mockGetRawConfig.mockResolvedValue({
        invalid_tier: { requireCodeApproval: true },
      });

      const policies = await SafetyConfigManager.getPolicies();

      expect(policies[SafetyTier.PROD]).toEqual(DEFAULT_POLICIES[SafetyTier.PROD]);
      expect(policies[SafetyTier.LOCAL]).toEqual(DEFAULT_POLICIES[SafetyTier.LOCAL]);
    });
  });

  describe('getPolicy', () => {
    it('returns policy for specific tier', async () => {
      mockGetRawConfig.mockResolvedValue(DEFAULT_POLICIES);

      const policy = await SafetyConfigManager.getPolicy(SafetyTier.PROD);

      expect(policy.tier).toBe(SafetyTier.PROD);
    });

    it('falls back to default for missing tier', async () => {
      mockGetRawConfig.mockResolvedValue({});

      const policy = await SafetyConfigManager.getPolicy(SafetyTier.PROD);

      expect(policy).toEqual(DEFAULT_POLICIES[SafetyTier.PROD]);
    });
  });

  describe('savePolicies', () => {
    it('merges partial policies with current and saves', async () => {
      mockGetRawConfig.mockResolvedValue(DEFAULT_POLICIES);
      mockSaveRawConfig.mockResolvedValue(undefined);

      await SafetyConfigManager.savePolicies({
        [SafetyTier.PROD]: { maxDeploymentsPerDay: 10 },
      });

      expect(mockSaveRawConfig).toHaveBeenCalledTimes(1);
      const savedPolicies = mockSaveRawConfig.mock.calls[0][1];
      expect(savedPolicies[SafetyTier.PROD].maxDeploymentsPerDay).toBe(10);
    });

    it('invalidates cache after save', async () => {
      mockGetRawConfig.mockResolvedValue(DEFAULT_POLICIES);
      mockSaveRawConfig.mockResolvedValue(undefined);

      await SafetyConfigManager.getPolicies();
      await SafetyConfigManager.savePolicies({
        [SafetyTier.PROD]: { maxDeploymentsPerDay: 10 },
      });
      await SafetyConfigManager.getPolicies();

      expect(mockGetRawConfig).toHaveBeenCalledTimes(2);
    });
  });
});
