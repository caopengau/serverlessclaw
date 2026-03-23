import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenRouterProvider } from './openrouter';
import { MessageRole } from '../types/index';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock SST Resource
vi.mock('sst', () => ({
  Resource: {
    OpenRouterApiKey: { value: 'test-key' },
  },
}));

describe('OpenRouterProvider', () => {
  let provider: OpenRouterProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenRouterProvider('minimax/minimax-m2.7');
  });

  it('should use standard OpenRouter format for MiniMax models', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { role: 'assistant', content: 'Response...' } }],
        }),
    });

    await provider.call([{ role: MessageRole.USER, content: 'test' }], []);

    const fetchArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchArgs[1].body);

    // MiniMax now uses direct API, OpenRouter should use standard format
    expect(body).toEqual(
      expect.objectContaining({
        model: 'minimax/minimax-m2.7',
        messages: [{ role: 'user', content: 'test' }],
      })
    );
  });

  it('should force json_object format for Gemini-3 models when json_schema is requested', async () => {
    provider = new OpenRouterProvider('google/gemini-3-flash-preview');

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { role: 'assistant', content: '{}' } }],
        }),
    });

    const responseFormat = {
      type: 'json_schema' as const,
      json_schema: {
        name: 'test_schema',
        strict: true,
        schema: { type: 'object', properties: {} },
      },
    };

    await provider.call(
      [{ role: MessageRole.USER, content: 'test' }],
      [],
      undefined,
      undefined,
      undefined,
      responseFormat
    );

    const fetchArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchArgs[1].body);

    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('should correctly pass json_schema response_format for GLM models', async () => {
    provider = new OpenRouterProvider('zhipu/glm-5');

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { role: 'assistant', content: '{}' } }],
        }),
    });

    const responseFormat = {
      type: 'json_schema' as const,
      json_schema: {
        name: 'test_schema',
        strict: true,
        schema: { type: 'object', properties: {} },
      },
    };

    await provider.call(
      [{ role: MessageRole.USER, content: 'test' }],
      [],
      undefined,
      undefined,
      undefined,
      responseFormat
    );

    const fetchArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchArgs[1].body);

    expect(body.response_format).toEqual(responseFormat);
  });

  it('should include require_parameters: true when tools are present', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { role: 'assistant', content: 'OK' } }],
        }),
    });

    const tools = [
      {
        name: 'test_tool',
        description: 'test',
        parameters: { type: 'object' as const, properties: {} },
        execute: async () => 'done',
      },
    ];

    await provider.call([{ role: MessageRole.USER, content: 'test' }], tools);

    const fetchArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchArgs[1].body);

    expect(body.provider).toEqual(
      expect.objectContaining({
        require_parameters: true,
      })
    );
  });

  it('should report specific context window for different models', async () => {
    const geminiCaps = await provider.getCapabilities('google/gemini-3-flash-preview');
    expect(geminiCaps.contextWindow).toBe(1048576);

    // MiniMax is now a direct provider, OpenRouter returns default context window
    const minimaxCaps = await provider.getCapabilities('minimax/minimax-m2.7');
    expect(minimaxCaps.contextWindow).toBe(128000);

    const defaultCaps = await provider.getCapabilities('other/model');
    expect(defaultCaps.contextWindow).toBe(128000);
  });
});
