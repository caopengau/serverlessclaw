import { MCPServerConfig } from '../types/mcp';

/**
 * Default MCP servers provided by Serverless Claw.
 */
export const DEFAULT_MCP_SERVERS: Record<string, MCPServerConfig> = {
  ast: { type: 'local', command: 'npx -y @aiready/ast-mcp-server@0.8.6' },
  filesystem: {
    type: 'local',
    command: 'npx --no-install -y @modelcontextprotocol/server-filesystem@0.6.2',
  },
  git: { type: 'local', command: 'npx --no-install -y @cyanheads/git-mcp-server@0.1.1' },
  'google-search': {
    type: 'local',
    command: 'npx --no-install -y @mcp-server/google-search-mcp@0.1.0',
  },
  puppeteer: {
    type: 'local',
    command: 'npx --no-install -y @kirkdeam/puppeteer-mcp-server@0.2.1',
  },
  fetch: { type: 'local', command: 'npx --no-install -y mcp-fetch-server@0.1.0' },
  aws: { type: 'local', command: 'npx --no-install -y mcp-aws-devops-server@0.1.0' },
  'aws-s3': { type: 'local', command: 'npx --no-install -y @geunoh/s3-mcp-server@0.1.0' },
};

/**
 * Registry of dynamic resolvers to eliminate special-case handling in the MCPBridge.
 * Each resolver modifies the server configuration based on the environment.
 */
export const SERVER_RESOLVERS: Record<
  string,
  (config: MCPServerConfig, env: NodeJS.ProcessEnv) => MCPServerConfig
> = {
  filesystem: (config, env) => {
    if (env.AWS_LAMBDA_FUNCTION_NAME) {
      const fsPath = env.MCP_FILESYSTEM_PATH ?? '/tmp';
      return {
        type: 'local',
        command: `npx -y @modelcontextprotocol/server-filesystem ${fsPath}`,
      };
    }
    return {
      type: 'local',
      command: `npx -y @modelcontextprotocol/server-filesystem .`,
    };
  },
};

/**
 * Common transport settings.
 */
export const TRANSPORT_DEFAULTS = {
  STDIO: {
    XDG_CACHE_HOME: '/tmp/mcp-cache',
    NPM_CONFIG_CACHE: '/tmp/npm-cache',
    HOME: '/tmp',
  },
  ALLOWED_LOCAL_IN_LAMBDA: ['filesystem', 'ast'],
};
