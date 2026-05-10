import { describe, it, expect } from 'vitest';
import { SelfUpdateEngine } from './self-update';

describe('SelfUpdateEngine (Autonomous Metabolism SC-4.2)', () => {
  it('should return a self-update result', async () => {
    const result = await SelfUpdateEngine.checkAndApplyUpdates('test-ws');
    
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('version');
    expect(result).toHaveProperty('appliedPatches');
    
    if (result.appliedPatches.length > 0) {
      expect(result.finding).toBeDefined();
      expect(result.finding?.silo).toBe('Metabolism');
    }
  });
});
