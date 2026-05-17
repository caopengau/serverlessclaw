import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetRecoveryAttemptCount } from './recovery-operations';

describe('recovery-operations', () => {
  let mockBase: any;

  beforeEach(() => {
    mockBase = {
      getScopedUserId: vi
        .fn()
        .mockImplementation((id, scope) => `WS#${scope?.workspaceId ?? 'global'}#${id}`),
      updateItem: vi.fn().mockResolvedValue({}),
    };
  });

  describe('resetRecoveryAttemptCount', () => {
    it('should use ConditionExpression for Principle 13 compliance', async () => {
      await resetRecoveryAttemptCount(mockBase as any, { workspaceId: 'ws1' });

      expect(mockBase.updateItem).toHaveBeenCalledWith(
        expect.objectContaining({
          ConditionExpression: 'attribute_exists(userId)',
          UpdateExpression: expect.stringContaining('SET #field = :zero'),
        })
      );
    });
  });
});
