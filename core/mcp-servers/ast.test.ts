import { describe, it, expect, vi } from 'vitest';
import { handler } from './ast';

vi.mock('./base-handler', () => ({
  createMCPServerHandler: vi.fn((params) => params),
}));

describe('AST MCP Server Handler', () => {
  it('should be initialized with correct parameters', () => {
    expect(handler).toBeDefined();
    const handlerAny = handler as any;
    expect(handlerAny.command).toBe('npx');
    expect(handlerAny.args).toContain('@aiready/ast-mcp-server@0.1.6');
    expect(handlerAny.env.HOME).toBe('/tmp');
  });
});
