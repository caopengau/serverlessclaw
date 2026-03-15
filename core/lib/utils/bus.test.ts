import { describe, it, expect } from 'vitest';
import { emitEvent } from './bus';

describe('emitEvent', () => {
  it('should export emitEvent as a function', () => {
    expect(emitEvent).toBeDefined();
    expect(typeof emitEvent).toBe('function');
  });

  it('should have correct function signature', () => {
    // The function should accept source, type, and detail parameters
    expect(emitEvent.length).toBe(3);
  });
});
