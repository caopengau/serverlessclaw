import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MCPBridge } from './mcp';
import { AgentRegistry } from './registry';

// Mock dependencies
vi.mock('./registry', () => ({
  AgentRegistry: {
    getRawConfig: vi.fn(),
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

// Mock MCP SDK
const mockConnect = vi.fn().mockResolvedValue(true);
const mockListTools = vi
  .fn()
  .mockResolvedValue({ tools: [{ name: 'test_tool', description: 'desc', inputSchema: {} }] });
const mockCallTool = vi.fn().mockResolvedValue({ content: [] });

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: class {
    connect = mockConnect;
    listTools = mockListTools;
    callTool = mockCallTool;
    close = vi.fn().mockResolvedValue(true);
  },
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: class {},
}));

describe('MCPBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (MCPBridge as any).clients.clear();
  });

  it('should lazy load ONLY requested servers', async () => {
    (AgentRegistry.getRawConfig as any).mockResolvedValue({
      srv1: { command: 'npx srv1' },
      srv2: { command: 'npx srv2' },
    });

    const tools = await MCPBridge.getExternalTools(['srv1_test_tool']);

    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe('srv1_test_tool');

    expect((MCPBridge as any).clients.size).toBe(1);
    expect((MCPBridge as any).clients.has('srv1')).toBe(true);
    expect((MCPBridge as any).clients.has('srv2')).toBe(false);
  });

  it('should load all servers if no requestedTools provided', async () => {
    (AgentRegistry.getRawConfig as any).mockResolvedValue({
      srv1: { command: 'npx srv1' },
      srv2: { command: 'npx srv2' },
    });

    const tools = await MCPBridge.getExternalTools();

    // Default servers (7) + our mock servers (2) = 9
    expect(tools.length).toBe(9);
    expect((MCPBridge as any).clients.size).toBe(9);
  });
});
