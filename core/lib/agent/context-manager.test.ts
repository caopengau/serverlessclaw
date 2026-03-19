import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContextManager } from './context-manager';
import { IMemory, MessageRole, Message } from '../types/index';

describe('ContextManager', () => {
  let mockMemory: IMemory;

  beforeEach(() => {
    mockMemory = {
      getHistory: vi.fn(),
      getSummary: vi.fn(),
      updateSummary: vi.fn(),
    } as unknown as IMemory;
  });

  describe('estimateTokens', () => {
    it('should estimate tokens based on character count', () => {
      const messages: Message[] = [
        { role: MessageRole.USER, content: 'Hello' },
        { role: MessageRole.ASSISTANT, content: 'Hi there!' },
      ];
      // "Hello" (5) + "Hi there!" (9) = 14 chars. 14 / 3 = 4.66 -> 5 tokens.
      expect(ContextManager.estimateTokens(messages)).toBe(5);
    });

    it('should include tool calls in estimation', () => {
      const messages: Message[] = [
        {
          role: MessageRole.ASSISTANT,
          tool_calls: [{ id: '1', type: 'function', function: { name: 'test', arguments: '{}' } }],
        },
      ];
      const estimate = ContextManager.estimateTokens(messages);
      expect(estimate).toBeGreaterThan(0);
    });
  });

  describe('getManagedContext', () => {
    it('should return recent messages that fit the limit', async () => {
      const history: Message[] = [
        { role: MessageRole.USER, content: 'Old message 1' },
        { role: MessageRole.ASSISTANT, content: 'Old message 2' },
        { role: MessageRole.USER, content: 'New message' },
      ];
      vi.mocked(mockMemory.getHistory).mockResolvedValue(history);
      vi.mocked(mockMemory.getSummary).mockResolvedValue(null);

      // Set a very small limit to force truncation
      const limit = 20; // ~60 chars
      const managed = await ContextManager.getManagedContext(history, null, 'System prompt', limit);

      expect(managed.messages.length).toBeGreaterThan(0);
      expect(managed.messages[0].role).toBe(MessageRole.SYSTEM);
      // The newest message should be included
      expect(managed.messages.some((m) => m.content === 'New message')).toBe(true);
    });

    it('should include the summary if available', async () => {
      vi.mocked(mockMemory.getHistory).mockResolvedValue([]);
      vi.mocked(mockMemory.getSummary).mockResolvedValue('Previously did X');

      const managed = await ContextManager.getManagedContext(
        [],
        'Previously did X',
        'System prompt'
      );

      expect(managed.messages.some((m) => m.content?.includes('Previously did X'))).toBe(true);
    });
  });

  describe('needsSummarization', () => {
    it('should return true if history exceeds 80% of limit', () => {
      const longMessage = 'A'.repeat(9000); // ~3000 tokens
      const history: Message[] = [{ role: MessageRole.USER, content: longMessage }];

      expect(ContextManager.needsSummarization(history, 2000)).toBe(true);
      expect(ContextManager.needsSummarization(history, 10000)).toBe(false);
    });
  });
});
