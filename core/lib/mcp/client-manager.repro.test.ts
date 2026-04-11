import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MCPClientManager } from './client-manager';
import { logger } from '../logger';

// Mock dependencies
vi.mock('../registry', () => ({
  AgentRegistry: {
    getRawConfig: vi.fn().mockResolvedValue(null),
    saveRawConfig: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

// We need to mock the MCP SDK Client and Transports
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: class {
    connect = vi.fn().mockResolvedValue(undefined);
    close = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: class {
    close = vi.fn().mockResolvedValue(undefined);
  },
}));

describe('MCPClientManager Thundering Herd Reproduction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset private static maps if possible, or just use different server names
    (MCPClientManager as any).clients.clear();
    (MCPClientManager as any).connecting.clear();
  });

  it('should only create one connection even when multiple connects are started in parallel', async () => {
    // Fire off multiple connections for the same server
    const p1 = MCPClientManager.connect('srv1', 'npx srv1');
    const p2 = MCPClientManager.connect('srv1', 'npx srv1');
    const p3 = MCPClientManager.connect('srv1', 'npx srv1');

    await Promise.all([p1, p2, p3]);

    const startConnectionCalls = vi
      .mocked(logger.info)
      .mock.calls.filter((call) => call[0] === 'Starting new connection for srv1');

    // IF IT'S BROKEN, this will be 3
    expect(startConnectionCalls.length).toBe(1);
  });
});
