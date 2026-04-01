/**
 * @module Template Handler Tests
 * @description Tests for the boilerplate agent handler template including
 * lazy dependency loading and event processing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './template';

const mockProcess = vi.fn();
const mockGetAgentConfig = vi.fn();
const mockGetAgentTools = vi.fn();

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../lib/memory', () => ({
  DynamoMemory: vi.fn(function () {
    return {};
  }),
}));

vi.mock('../lib/agent', () => ({
  Agent: class {
    process = mockProcess;
  },
}));

vi.mock('../lib/providers/index', () => ({
  ProviderManager: vi.fn(function () {
    return {};
  }),
}));

vi.mock('../tools/index', () => ({
  getAgentTools: (...args: unknown[]) => mockGetAgentTools(...args),
}));

vi.mock('../lib/registry', () => ({
  AgentRegistry: {
    getAgentConfig: (...args: unknown[]) => mockGetAgentConfig(...args),
  },
}));

vi.mock('../lib/types/index', () => ({
  AgentType: { SUPERCLAW: 'superclaw' },
}));

describe('template handler', () => {
  const event = { userId: 'user-1', data: 'do something' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAgentConfig.mockResolvedValue({
      systemPrompt: 'You are a helpful agent.',
      category: 'core',
      defaultCommunicationMode: 'text',
    });
    mockGetAgentTools.mockResolvedValue([]);
    mockProcess.mockResolvedValue({ responseText: 'done' });
  });

  it('returns the agent response text', async () => {
    const result = await handler(event);

    expect(result).toBe('done');
  });

  it('passes userId and prefixed data to agent.process', async () => {
    await handler(event);

    expect(mockProcess).toHaveBeenCalledWith('user-1', 'TASK: do something');
  });

  it('loads config from AgentRegistry for SUPERCLAW', async () => {
    await handler(event);

    expect(mockGetAgentConfig).toHaveBeenCalled();
  });

  it('loads tools via getAgentTools for SUPERCLAW', async () => {
    await handler(event);

    expect(mockGetAgentTools).toHaveBeenCalled();
  });

  it('throws when agent config is missing', async () => {
    mockGetAgentConfig.mockResolvedValue(null);

    await expect(handler(event)).rejects.toThrow('Config load failed');
  });

  it('propagates agent process errors', async () => {
    mockProcess.mockRejectedValue(new Error('agent failure'));

    await expect(handler(event)).rejects.toThrow('agent failure');
  });

  it('handles empty data string', async () => {
    mockProcess.mockResolvedValue({ responseText: 'empty response' });

    const result = await handler({ userId: 'user-1', data: '' });

    expect(result).toBe('empty response');
    expect(mockProcess).toHaveBeenCalledWith('user-1', 'TASK: ');
  });
});
