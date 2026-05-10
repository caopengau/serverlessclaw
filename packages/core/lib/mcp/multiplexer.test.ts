import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MCPMultiplexer } from './multiplexer';
import { MCPBridge } from './mcp-bridge';
import { AgentRegistry } from '../registry';

vi.mock('./mcp-bridge');
vi.mock('../registry');
vi.mock('../logger');

describe('MCPMultiplexer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should resolve tools from MCPBridge', async () => {
    const mockTools = [
      { name: 'server1_tool1', description: 'desc1' },
      { name: 'server2_tool1', description: 'desc2' },
    ];

    vi.mocked(MCPBridge.getExternalTools).mockResolvedValue(mockTools as any);

    const tools = await MCPMultiplexer.resolveTools({ workspaceId: 'test-ws' });

    expect(tools).toHaveLength(2);
    expect(tools[0].name).toBe('server1_tool1');
    expect(MCPBridge.getExternalTools).toHaveBeenCalledWith(undefined, false, 'test-ws');
  });

  it('should register a new server in the registry', async () => {
    const mockConfig = { type: 'local', command: 'test-cmd' };
    vi.mocked(AgentRegistry.getRawConfig).mockResolvedValue({});

    await MCPMultiplexer.registerServer('new-server', mockConfig, 'test-ws');

    expect(AgentRegistry.saveRawConfig).toHaveBeenCalledWith(
      'mcp_servers',
      { 'new-server': mockConfig },
      { workspaceId: 'test-ws' }
    );
  });

  it('should handle discovery failures gracefully', async () => {
    vi.mocked(MCPBridge.getExternalTools).mockRejectedValue(new Error('Discovery failed'));

    const tools = await MCPMultiplexer.resolveTools();

    expect(tools).toEqual([]);
  });
});
