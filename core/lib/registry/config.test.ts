import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigManager } from './config';

vi.mock('sst', () => ({
  Resource: {}, // ConfigTable is missing
}));

describe('ConfigManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should safely return undefined when ConfigTable is not linked', async () => {
    // Should not throw TypeError when checking 'ConfigTable' in Resource
    const value = await ConfigManager.getRawConfig('any_key');
    expect(value).toBeUndefined();
  });

  it('should safely return undefined when getTypedConfig is called and ConfigTable is not linked', async () => {
    const value = await ConfigManager.getTypedConfig('any_key', 'fallback_value');
    expect(value).toBe('fallback_value');
  });
});
