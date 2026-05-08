import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeepSeekProvider } from './deepseek';
import { MessageRole, ReasoningProfile, DeepSeekModel } from '../types/index';
import { resolveProviderApiKey } from './utils';

vi.mock('./utils', () => ({
  resolveProviderApiKey: vi.fn().mockReturnValue('sk-test-deepseek-key'),
  normalizeProfile: vi.fn().mockImplementation((profile) => profile),
  capEffort: vi.fn().mockImplementation((effort) => effort),
}));

// Mock global fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('DeepSeekProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should default to V4_FLASH model', () => {
      const provider = new DeepSeekProvider();
      expect(provider).toBeDefined();
      // Internal model is private, but we can test via getCapabilities default
    });

    it('should accept custom model', () => {
      const provider = new DeepSeekProvider(DeepSeekModel.V4_PRO);
      expect(provider).toBeDefined();
    });
  });

  describe('getCapabilities', () => {
    it('should return all four reasoning profiles for Pro model', async () => {
      const provider = new DeepSeekProvider(DeepSeekModel.V4_PRO);
      const caps = await provider.getCapabilities();
      expect(caps.supportedReasoningProfiles).toContain(ReasoningProfile.FAST);
      expect(caps.supportedReasoningProfiles).toContain(ReasoningProfile.STANDARD);
      expect(caps.supportedReasoningProfiles).toContain(ReasoningProfile.THINKING);
      expect(caps.supportedReasoningProfiles).toContain(ReasoningProfile.DEEP);
      expect(caps.maxReasoningEffort).toBe('high');
      expect(caps.supportsStructuredOutput).toBe(true);
      expect(caps.contextWindow).toBe(131072);
    });

    it('should return three reasoning profiles for Flash model', async () => {
      const provider = new DeepSeekProvider(DeepSeekModel.V4_FLASH);
      const caps = await provider.getCapabilities();
      expect(caps.supportedReasoningProfiles).toContain(ReasoningProfile.FAST);
      expect(caps.supportedReasoningProfiles).toContain(ReasoningProfile.STANDARD);
      expect(caps.supportedReasoningProfiles).toContain(ReasoningProfile.THINKING);
      expect(caps.supportedReasoningProfiles).not.toContain(ReasoningProfile.DEEP);
      expect(caps.maxReasoningEffort).toBe('medium');
    });
  });

  describe('call', () => {
    it('should return a valid Message on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Hello from DeepSeek!',
                reasoning_content: 'Let me reason about this...',
              },
            },
          ],
          usage: {
            prompt_tokens: 15,
            completion_tokens: 30,
            total_tokens: 45,
          },
        }),
      });

      const provider = new DeepSeekProvider();
      const result = await provider.call([
        {
          role: MessageRole.USER,
          content: 'Hi',
          traceId: 'test-trace',
          messageId: 'test-msg',
        },
      ]);

      expect(result.role).toBe(MessageRole.ASSISTANT);
      expect(result.content).toBe('Hello from DeepSeek!');
      expect(result.thought).toBe('Let me reason about this...');
      expect(result.usage?.total_tokens).toBe(45);
      expect(result.traceId).toBe('test-trace');
      expect(result.messageId).toBeDefined();
    });

    it('should handle tool calls in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'call_1',
                    type: 'function',
                    function: {
                      name: 'get_weather',
                      arguments: '{"city":"Sydney"}',
                    },
                  },
                ],
              },
            },
          ],
          usage: {
            prompt_tokens: 20,
            completion_tokens: 10,
            total_tokens: 30,
          },
        }),
      });

      const provider = new DeepSeekProvider();
      const result = await provider.call(
        [
          {
            role: MessageRole.USER,
            content: 'What is the weather?',
            traceId: 'test-trace',
            messageId: 'test-msg',
          },
        ],
        [
          {
            name: 'get_weather',
            description: 'Get weather for a city',
            parameters: { type: 'object', properties: { city: { type: 'string' } } },
          },
        ]
      );

      expect(result.tool_calls).toBeDefined();
      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls![0].function.name).toBe('get_weather');
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      const provider = new DeepSeekProvider();
      await expect(
        provider.call([
          {
            role: MessageRole.USER,
            content: 'Hi',
            traceId: 'test-trace',
            messageId: 'test-msg',
          },
        ])
      ).rejects.toThrow(/DeepSeek Provider error: 401/);
    });

    it('should throw on empty response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [] }),
      });

      const provider = new DeepSeekProvider();
      await expect(
        provider.call([
          {
            role: MessageRole.USER,
            content: 'Hi',
            traceId: 'test-trace',
            messageId: 'test-msg',
          },
        ])
      ).rejects.toThrow('DeepSeek provider call failed: No message in response');
    });
  });

  describe('stream', () => {
    it('should yield content from streaming response', async () => {
      const mockStreamResponse = createMockStreamResponse([
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n',
        'data: {"choices":[{"delta":{"content":"!"}}]}\n',
        'data: [DONE]\n',
      ]);

      mockFetch.mockResolvedValueOnce(mockStreamResponse);

      const provider = new DeepSeekProvider();
      const chunks: string[] = [];
      for await (const chunk of provider.stream([
        {
          role: MessageRole.USER,
          content: 'Hi',
          traceId: 'test-trace',
          messageId: 'test-msg',
        },
      ])) {
        if (chunk.content) chunks.push(chunk.content);
      }

      expect(chunks.join('')).toBe('Hello world!');
    });

    it('should yield reasoning content as thought', async () => {
      const mockStreamResponse = createMockStreamResponse([
        'data: {"choices":[{"delta":{"reasoning_content":"I think"}}]}\n',
        'data: {"choices":[{"delta":{"reasoning_content":" deeply"}}]}\n',
        'data: {"choices":[{"delta":{"content":"Answer"}}]}\n',
        'data: [DONE]\n',
      ]);

      mockFetch.mockResolvedValueOnce(mockStreamResponse);

      const provider = new DeepSeekProvider();
      const thoughts: string[] = [];
      for await (const chunk of provider.stream([
        {
          role: MessageRole.USER,
          content: 'Hi',
          traceId: 'test-trace',
          messageId: 'test-msg',
        },
      ])) {
        if (chunk.thought) thoughts.push(chunk.thought);
      }

      expect(thoughts).toContain('I think');
      expect(thoughts).toContain(' deeply');
    });

    it('should yield usage from stream', async () => {
      const mockStreamResponse = createMockStreamResponse([
        'data: {"choices":[{"delta":{"content":"done"}}],"usage":{"prompt_tokens":5,"completion_tokens":10,"total_tokens":15}}\n',
        'data: [DONE]\n',
      ]);

      mockFetch.mockResolvedValueOnce(mockStreamResponse);

      const provider = new DeepSeekProvider();
      let usageFound = false;
      for await (const chunk of provider.stream([
        {
          role: MessageRole.USER,
          content: 'Hi',
          traceId: 'test-trace',
          messageId: 'test-msg',
        },
      ])) {
        if (chunk.usage) {
          usageFound = true;
          expect(chunk.usage.total_tokens).toBe(15);
        }
      }

      expect(usageFound).toBe(true);
    });

    it('should handle streaming errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const provider = new DeepSeekProvider();
      let errorContent = '';
      for await (const chunk of provider.stream([
        {
          role: MessageRole.USER,
          content: 'Hi',
          traceId: 'test-trace',
          messageId: 'test-msg',
        },
      ])) {
        if (chunk.content) errorContent = chunk.content;
      }

      expect(errorContent).toBe(' (Streaming failed)');
    });
  });
});

/**
 * Helper to create a mock ReadableStream response for SSE streaming.
 */
function createMockStreamResponse(lines: string[]) {
  const encoder = new TextEncoder();
  const chunks = lines.map((line) => encoder.encode(line));

  return {
    ok: true,
    body: {
      getReader: () => {
        let index = 0;
        return {
          read: async () => {
            if (index >= chunks.length) {
              return { done: true, value: undefined };
            }
            return { done: false, value: chunks[index++] };
          },
          cancel: () => {},
          releaseLock: () => {},
        };
      },
    },
  };
}