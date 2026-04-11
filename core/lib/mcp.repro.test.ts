import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MCPBridge } from './mcp';
import { MCPClientManager } from './mcp/client-manager';

vi.mock('./registry', () => ({
  AgentRegistry: {
    getRawConfig: vi.fn().mockResolvedValue(null),
    saveRawConfig: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('./logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('./mcp/client-manager', () => ({
  MCPClientManager: {
    connect: vi.fn(),
    deleteClient: vi.fn(),
  },
}));

vi.mock('./lock/lock-manager', () => ({
  LockManager: class {
    acquire = vi.fn().mockResolvedValue(true);
    release = vi.fn().mockResolvedValue(true);
  },
}));

describe('MCPBridge Thundering Herd Reproduction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should only call connect once even when multiple discoveries are started in parallel', async () => {
    const mockClient = {
      listTools: vi.fn().mockResolvedValue({ tools: [] }),
    };

    // Make connect slow to increase chance of race if not protected
    vi.mocked(MCPClientManager.connect).mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return mockClient as any;
    });

    // Fire off multiple requests for the same server in parallel
    const p1 = MCPBridge.getToolsFromServer('srv1', 'npx srv1');
    const p2 = MCPBridge.getToolsFromServer('srv1', 'npx srv1');
    const p3 = MCPBridge.getToolsFromServer('srv1', 'npx srv1');

    await Promise.all([p1, p2, p3]);

    // If Thundering Herd protection works perfectly, connect should only be called ONCE
    expect(MCPClientManager.connect).toHaveBeenCalledTimes(1);
  });
});
