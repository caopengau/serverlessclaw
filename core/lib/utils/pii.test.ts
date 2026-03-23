import { describe, it, expect } from 'vitest';
import { filterPII, filterPIIFromObject } from './pii';

describe('PII Filter', () => {
  describe('filterPII', () => {
    it('should mask emails', () => {
      expect(filterPII('Contact me at test@example.com')).toBe('Contact me at [EMAIL_REDACTED]');
    });

    it('should mask API keys', () => {
      // Test various separators
      expect(filterPII('My key: sk-1234567890abcdef')).toBe('My key: [SECRET_REDACTED]');
      expect(filterPII('api_key = some-long-secret-token')).toBe('api_key = [SECRET_REDACTED]');
      expect(filterPII('password is mypassword123')).toBe('password is [SECRET_REDACTED]');
    });
  });

  describe('filterPIIFromObject', () => {
    it('should recursively mask strings in objects', () => {
      const obj = {
        email: 'test@example.com',
        credentials: {
          password: 'secret-password-123',
        },
      };
      const filtered: any = filterPIIFromObject(obj);
      expect(filtered.email).toBe('[EMAIL_REDACTED]');
      // The keyword 'password' should match and mask the value
      expect(filtered.credentials.password).toBe('[SECRET_REDACTED]');
    });

    it('should SKIP filtering for tool_calls and function keys to avoid JSON corruption', () => {
      const obj = {
        role: 'assistant',
        content: 'I will save test@example.com',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'save_memory',
              arguments: '{"content":"my password is secret", "email":"test@example.com"}',
            },
          },
        ],
      };

      const filtered: any = filterPIIFromObject(obj);

      // content SHOULD be filtered
      expect(filtered.content).toContain('[EMAIL_REDACTED]');

      // tool_calls arguments SHOULD NOT be filtered (to keep JSON valid)
      expect(filtered.tool_calls[0].function.arguments).toContain('my password is secret');
      expect(filtered.tool_calls[0].function.arguments).toContain('test@example.com');

      // verify it's still valid JSON
      expect(() => JSON.parse(filtered.tool_calls[0].function.arguments)).not.toThrow();
    });
  });
});
