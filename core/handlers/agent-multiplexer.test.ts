import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './agent-multiplexer';
import { EventType } from '../lib/types/agent';
import { Context } from 'aws-lambda';
import * as agentHelpers from '../lib/utils/agent-helpers';

// Mock WarmupManager
vi.mock('../lib/warmup', () => ({
  WarmupManager: vi.fn().mockImplementation(() => ({
    recordWarmState: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mocking agent-helpers
vi.mock('../lib/utils/agent-helpers', () => ({
  handleWarmup: vi.fn(),
  initAgent: vi.fn(),
}));

// Mock logger to avoid console spam during tests
vi.mock('../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AgentMultiplexer', () => {
  const mockContext = {
    awsRequestId: 'test-request-id',
  } as Context;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle centralized warmup and return WARM', async () => {
    vi.mocked(agentHelpers.handleWarmup).mockResolvedValue(true);

    const event = { 'detail-type': 'WARMUP' };
    const result = await handler(event, mockContext);

    expect(result).toBe('WARM');
    expect(agentHelpers.handleWarmup).toHaveBeenCalledWith(event, 'brain');
  });

  it('should route CODER_TASK to coder agent', async () => {
    vi.mocked(agentHelpers.handleWarmup).mockResolvedValue(false);

    // Mock dynamic import for coder
    vi.mock('../agents/coder', () => ({
      handler: vi.fn().mockResolvedValue('CODER_DONE'),
    }));

    const event = { 'detail-type': EventType.CODER_TASK };
    const result = await handler(event, mockContext);

    expect(result).toBe('CODER_DONE');
  });

  it('should route QA_TASK to qa agent', async () => {
    vi.mocked(agentHelpers.handleWarmup).mockResolvedValue(false);

    // Mock dynamic import for QA
    vi.mock('../agents/qa', () => ({
      handler: vi.fn().mockResolvedValue('QA_DONE'),
    }));

    const event = { 'detail-type': 'qa_task' };
    const result = await handler(event, mockContext);

    expect(result).toBe('QA_DONE');
  });

  it('should route CRITIC_TASK to critic agent', async () => {
    vi.mocked(agentHelpers.handleWarmup).mockResolvedValue(false);

    // Mock dynamic import for critic
    vi.mock('../agents/critic', () => ({
      handler: vi.fn().mockResolvedValue('CRITIC_DONE'),
    }));

    const event = { 'detail-type': 'critic_task' };
    const result = await handler(event, mockContext);

    expect(result).toBe('CRITIC_DONE');
  });

  it('should return undefined for unrecognized event types', async () => {
    vi.mocked(agentHelpers.handleWarmup).mockResolvedValue(false);

    const event = { 'detail-type': 'unsupported_event' };
    const result = await handler(event, mockContext);

    expect(result).toBeUndefined();
  });

  it('should throw error if agent module does not export a handler', async () => {
    vi.mocked(agentHelpers.handleWarmup).mockResolvedValue(false);

    // Mock dynamic import returning invalid module
    vi.mock('../agents/merger', () => ({
      handler: 'not-a-function',
    }));

    const event = { 'detail-type': EventType.MERGER_TASK };
    await expect(handler(event, mockContext)).rejects.toThrow(
      'Agent merger does not export a valid handler function.'
    );
  });
});
