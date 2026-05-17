import { describe, it, expect } from 'vitest';
import { normalizeMessage } from './normalize';
import { InboundMessage } from './types';

describe('normalizeMessage sanitization', () => {
  it('should sanitize userId with CONV# prefix', () => {
    const raw: InboundMessage = {
      source: 'test',
      userId: 'CONV#SYSTEM#leak',
      sessionId: 'sess1',
      text: 'hello',
      attachments: [],
      metadata: {},
      timestamp: new Date().toISOString(),
    };
    const normalized = normalizeMessage(raw);
    expect(normalized.userId).toBe('CONV_SYSTEM_leak');
    // normalizeBaseUserId('CONV_SYSTEM_leak') will return 'CONV_SYSTEM_leak', not 'SYSTEM'
  });

  it('should sanitize userId with internal # characters', () => {
    const raw: InboundMessage = {
      source: 'test',
      userId: 'user#123',
      sessionId: 'sess1',
      text: 'hello',
      attachments: [],
      metadata: {},
      timestamp: new Date().toISOString(),
    };
    const normalized = normalizeMessage(raw);
    expect(normalized.userId).toBe('user_123');
  });

  it('should sanitize sessionId with # characters', () => {
    const raw: InboundMessage = {
      source: 'test',
      userId: 'user1',
      sessionId: 'sess#456',
      text: 'hello',
      attachments: [],
      metadata: {},
      timestamp: new Date().toISOString(),
    };
    const normalized = normalizeMessage(raw);
    expect(normalized.sessionId).toBe('sess_456');
  });

  it('should leave clean userId unchanged', () => {
    const raw: InboundMessage = {
      source: 'test',
      userId: 'user123',
      sessionId: 'sess1',
      text: 'hello',
      attachments: [],
      metadata: {},
      timestamp: new Date().toISOString(),
    };
    const normalized = normalizeMessage(raw);
    expect(normalized.userId).toBe('user123');
  });
});
