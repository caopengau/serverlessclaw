import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FeatureFlags, FeatureFlag } from './feature-flags';

vi.mock('./registry/config', () => ({
  ConfigManager: {
    getTypedConfig: vi.fn().mockResolvedValue(true),
    getRawConfig: vi.fn().mockResolvedValue(undefined),
    saveRawConfig: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('FeatureFlags', () => {
  let mockConfigManager: any;

  beforeEach(async () => {
    const configModule = await import('./registry/config');
    mockConfigManager = vi.mocked(configModule.ConfigManager);
    vi.clearAllMocks();
    mockConfigManager.getTypedConfig.mockResolvedValue(true);
    mockConfigManager.getRawConfig.mockResolvedValue(undefined);
    mockConfigManager.saveRawConfig.mockResolvedValue(undefined);
    FeatureFlags.clearCache();
  });

  afterEach(() => {
    FeatureFlags.clearCache();
  });

  describe('isEnabled', () => {
    it('should return false when global feature flags are disabled', async () => {
      mockConfigManager.getTypedConfig.mockResolvedValueOnce(false);

      const result = await FeatureFlags.isEnabled('test_flag');
      expect(result).toBe(false);
    });

    it('should return false when flag does not exist', async () => {
      const result = await FeatureFlags.isEnabled('nonexistent');
      expect(result).toBe(false);
    });

    it('should return false when flag is disabled', async () => {
      const flag: FeatureFlag = {
        name: 'test_flag',
        enabled: false,
        rolloutPercent: 100,
        description: 'Test',
      };
      mockConfigManager.getRawConfig.mockResolvedValueOnce(flag);

      const result = await FeatureFlags.isEnabled('test_flag');
      expect(result).toBe(false);
    });

    it('should return true when flag is enabled with 100% rollout', async () => {
      const flag: FeatureFlag = {
        name: 'test_flag',
        enabled: true,
        rolloutPercent: 100,
        description: 'Test',
      };
      mockConfigManager.getRawConfig.mockResolvedValueOnce(flag);

      const result = await FeatureFlags.isEnabled('test_flag');
      expect(result).toBe(true);
    });

    it('should return false when flag has 0% rollout', async () => {
      const flag: FeatureFlag = {
        name: 'test_flag',
        enabled: true,
        rolloutPercent: 0,
        description: 'Test',
      };
      mockConfigManager.getRawConfig.mockResolvedValueOnce(flag);

      const result = await FeatureFlags.isEnabled('test_flag');
      expect(result).toBe(false);
    });

    it('should evaluate rolloutPercent deterministically', async () => {
      const flag: FeatureFlag = {
        name: 'test_flag',
        enabled: true,
        rolloutPercent: 50,
        description: 'Test',
      };
      mockConfigManager.getRawConfig.mockResolvedValue(flag);

      const result1 = await FeatureFlags.isEnabled('test_flag', 'agent_1');
      const result2 = await FeatureFlags.isEnabled('test_flag', 'agent_1');
      expect(result1).toBe(result2);
    });

    it('should respect targetAgents filter', async () => {
      const flag: FeatureFlag = {
        name: 'test_flag',
        enabled: true,
        rolloutPercent: 100,
        targetAgents: ['coder', 'planner'],
        description: 'Test',
      };
      mockConfigManager.getRawConfig.mockResolvedValue(flag);

      expect(await FeatureFlags.isEnabled('test_flag', 'coder')).toBe(true);
      expect(await FeatureFlags.isEnabled('test_flag', 'stranger')).toBe(false);
    });

    it('should return false when agentId not provided but targetAgents specified', async () => {
      const flag: FeatureFlag = {
        name: 'test_flag',
        enabled: true,
        rolloutPercent: 100,
        targetAgents: ['coder'],
        description: 'Test',
      };
      mockConfigManager.getRawConfig.mockResolvedValue(flag);

      expect(await FeatureFlags.isEnabled('test_flag')).toBe(false);
    });

    it('should cache flag results for 60 seconds', async () => {
      const flag: FeatureFlag = {
        name: 'cached_flag',
        enabled: true,
        rolloutPercent: 100,
        description: 'Test',
      };
      mockConfigManager.getRawConfig.mockResolvedValueOnce(flag);

      await FeatureFlags.isEnabled('cached_flag');
      await FeatureFlags.isEnabled('cached_flag');

      expect(mockConfigManager.getRawConfig).toHaveBeenCalledTimes(1);
    });
  });

  describe('setFlag', () => {
    it('should save a feature flag to ConfigManager and update the list', async () => {
      const flag: FeatureFlag = {
        name: 'new_flag',
        enabled: true,
        rolloutPercent: 25,
        description: 'A new feature',
      };

      mockConfigManager.getTypedConfig.mockImplementation((key: string, def: any) => {
        if (key === 'feature_flags_list') return Promise.resolve([]);
        return Promise.resolve(def);
      });

      await FeatureFlags.setFlag(flag);

      expect(mockConfigManager.saveRawConfig).toHaveBeenCalledTimes(2);
      const [key1, value1, options1] = mockConfigManager.saveRawConfig.mock.calls[0];
      expect(key1).toBe('feature_flag_new_flag');
      expect(value1).toMatchObject({ name: 'new_flag', enabled: true, rolloutPercent: 25 });
      expect(options1.skipVersioning).toBe(true);

      const [key2, value2, options2] = mockConfigManager.saveRawConfig.mock.calls[1];
      expect(key2).toBe('feature_flags_list');
      expect(value2).toEqual(['new_flag']);
      expect(options2.skipVersioning).toBe(true);
    });

    it('should not update the list if flag is already present', async () => {
      const flag: FeatureFlag = {
        name: 'existing_flag',
        enabled: true,
        rolloutPercent: 25,
        description: 'An existing feature',
      };

      mockConfigManager.getTypedConfig.mockImplementation((key: string, def: any) => {
        if (key === 'feature_flags_list') return Promise.resolve(['existing_flag']);
        return Promise.resolve(def);
      });

      await FeatureFlags.setFlag(flag);

      expect(mockConfigManager.saveRawConfig).toHaveBeenCalledTimes(1);
      const [key] = mockConfigManager.saveRawConfig.mock.calls[0];
      expect(key).toBe('feature_flag_existing_flag');
    });

    it('should clear the cache when flag is updated', async () => {
      const flag: FeatureFlag = {
        name: 'cached_flag',
        enabled: true,
        rolloutPercent: 100,
        description: 'Test',
      };
      mockConfigManager.getRawConfig.mockResolvedValueOnce(flag);

      await FeatureFlags.isEnabled('cached_flag');
      expect(mockConfigManager.getRawConfig).toHaveBeenCalledTimes(1);

      await FeatureFlags.setFlag({ ...flag, enabled: false });

      mockConfigManager.getRawConfig.mockResolvedValueOnce({ ...flag, enabled: false });
      const result = await FeatureFlags.isEnabled('cached_flag');

      expect(result).toBe(false);
    });
  });
});
