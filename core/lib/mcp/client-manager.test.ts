import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MCPClientManager } from './client-manager';

// Mock child_process for npx path resolution
const mockExecSync = vi.fn().mockReturnValue('/usr/bin/npx\n');
vi.mock('child_process', () => ({
  execSync: (cmd: string) => mockExecSync(cmd),
}));

// Mock fs for the fallback in npx resolution
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
}));

// Mock MCP SDK
const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockClose = vi.fn().mockResolvedValue(undefined);

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: class {
    connect = mockConnect;
    close = mockClose;
    constructor(_info: any, _options: any) {}
  },
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: class {
    constructor(_options: any) {}
    onclose?: () => void;
  },
}));

vi.mock('@modelcontextprotocol/sdk/client/sse.js', () => ({
  SSEClientTransport: class {
    constructor(_url: URL) {}
    onclose?: () => void;
  },
}));

vi.mock('../logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('MCPClientManager', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // We can't easily clear the static private maps, but we can closeAll
    await MCPClientManager.closeAll();
  });

  afterEach(async () => {
    await MCPClientManager.closeAll();
    vi.useRealTimers();
  });

  it('connects via SSE if connectionString starts with http', async () => {
    const client = await MCPClientManager.connect('test-server', 'http://localhost:8080');
    expect(client).toBeDefined();
    expect(mockConnect).toHaveBeenCalled();
  });

  it('connects via Stdio for non-http strings', async () => {
    const client = await MCPClientManager.connect('stdio-server', 'node server.js');
    expect(client).toBeDefined();
    expect(mockConnect).toHaveBeenCalled();
  });

  it('reuses existing connection', async () => {
    const client1 = await MCPClientManager.connect('reuse-server', 'node server.js');
    const client2 = await MCPClientManager.connect('reuse-server', 'node server.js');

    expect(client1).toBe(client2);
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it('handles concurrent connection requests', async () => {
    const p1 = MCPClientManager.connect('concurrent-server', 'node server.js');
    const p2 = MCPClientManager.connect('concurrent-server', 'node server.js');
    const [client1, client2] = await Promise.all([p1, p2]);

    expect(client1).toBe(client2);
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it('deletes client', async () => {
    await MCPClientManager.connect('delete-server', 'node server.js');
    MCPClientManager.deleteClient('delete-server');
    expect(MCPClientManager.getClient('delete-server')).toBeUndefined();
  });

  it('closes all clients', async () => {
    await MCPClientManager.connect('server1', 'node s1.js');
    await MCPClientManager.connect('server2', 'node s2.js');

    await MCPClientManager.closeAll();
    expect(mockClose).toHaveBeenCalledTimes(2);
  });

  /*
  it('handles connection timeout', async () => {
    vi.useFakeTimers();
    // Mock connect to never resolve
    mockConnect.mockReturnValue(new Promise(() => {}));
    
    const connectPromise = MCPClientManager.connect('timeout-server', 'http://hub-url/mcp');
    
    // The code uses 5000ms if it matches MCP_HUB_URL. 
    // Let's ensure it matches or just use a large enough time.
    process.env.MCP_HUB_URL = 'hub-url';
    
    await vi.advanceTimersByTimeAsync(5001);
    
    await expect(connectPromise).rejects.toThrow('MCP Connection timeout after 5000ms');
  });

  it('resolves npx path for stdio', async () => {
    mockExecSync.mockReturnValue('/usr/bin/npx\n');
    const client = await MCPClientManager.connect('npx-server', 'npx @mcp/server');
    expect(client).toBeDefined();
    expect(mockExecSync).toHaveBeenCalledWith('which npx', expect.any(Object));
  });
*/
});
