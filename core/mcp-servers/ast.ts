import { createMCPServerHandler } from './base-handler';

/**
 * AST-aware code analysis MCP server.
 * Uses @aiready/ast-mcp-server for structural analysis, search, and refactoring.
 */
const serverParams = {
  command: 'npx',
  args: ['--offline', '@aiready/ast-mcp-server@0.1.6'],
  env: {
    HOME: '/tmp',
    NPM_CONFIG_CACHE: '/tmp/npm-cache',
    XDG_CACHE_HOME: '/tmp/mcp-cache',
  },
};

export const handler = createMCPServerHandler(serverParams);
