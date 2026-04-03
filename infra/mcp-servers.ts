import {
  SharedContext,
  getValidSecrets,
  LAMBDA_ARCHITECTURE,
  NODEJS_LOADERS,
  LOG_RETENTION_PERIOD,
} from './shared';

/**
 * Deploys MCP (Model Context Protocol) servers as separate Lambda functions.
 * Each MCP server runs independently for fault isolation and independent scaling.
 *
 * Uses @aws/run-mcp-servers-with-aws-lambda to wrap stdio-based MCP servers.
 */

// MCP Server configurations
const MCP_SERVER_CONFIGS = {
  git: {
    handler: 'core/mcp-servers/git.handler',
    memory: '128 MB' as const,
    timeout: '30 seconds' as const,
    description: 'Git operations via @cyanheads/git-mcp-server',
    warmSchedule: 'rate(5 minutes)', // Critical - keep warm
  },
  filesystem: {
    handler: 'core/mcp-servers/filesystem.handler',
    memory: '128 MB' as const,
    timeout: '30 seconds' as const,
    description: 'Filesystem operations via @modelcontextprotocol/server-filesystem',
    warmSchedule: 'rate(5 minutes)', // Critical - keep warm
  },
  'google-search': {
    handler: 'core/mcp-servers/google-search.handler',
    memory: '256 MB' as const,
    timeout: '60 seconds' as const,
    description: 'Google search via @mcp-server/google-search-mcp',
    warmSchedule: 'rate(15 minutes)', // Less critical
  },
  puppeteer: {
    handler: 'core/mcp-servers/puppeteer.handler',
    memory: '512 MB' as const,
    timeout: '120 seconds' as const,
    description: 'Browser automation via @kirkdeam/puppeteer-mcp-server',
    warmSchedule: 'rate(30 minutes)', // Rarely used
  },
  fetch: {
    handler: 'core/mcp-servers/fetch.handler',
    memory: '128 MB' as const,
    timeout: '60 seconds' as const,
    description: 'HTTP fetch operations via mcp-fetch-server',
    warmSchedule: 'rate(15 minutes)',
  },
  aws: {
    handler: 'core/mcp-servers/aws.handler',
    memory: '256 MB' as const,
    timeout: '60 seconds' as const,
    description: 'AWS operations via mcp-aws-devops-server',
    warmSchedule: 'rate(15 minutes)',
  },
  'aws-s3': {
    handler: 'core/mcp-servers/aws-s3.handler',
    memory: '256 MB' as const,
    timeout: '60 seconds' as const,
    description: 'S3 operations via @geunoh/s3-mcp-server',
  },
  ast: {
    handler: 'core/mcp-servers/ast.handler',
    memory: '512 MB' as const,
    timeout: '120 seconds' as const,
    description: 'AST-aware code analysis via @aiready/ast-mcp-server',
  },
} as const;

type MCPServerName = keyof typeof MCP_SERVER_CONFIGS;

export interface MCPServerResources {
  servers: Record<MCPServerName, sst.aws.Function>;
}

/**
 * Creates all MCP server Lambda functions.
 *
 * @param ctx - The shared infrastructure context containing tables, buckets, and secrets.
 * @returns The created MCP server functions.
 */
export function createMCPServers(ctx: SharedContext): MCPServerResources {
  const { memoryTable, configTable, secrets } = ctx;
  const liveInLocalOnly = $app.stage === 'local' ? undefined : false;

  // Base permissions for MCP servers
  const basePermissions = [
    {
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
    },
  ];

  // Base links for MCP servers (minimal - they don't need full agent access)
  const baseLink = [memoryTable, configTable, ...getValidSecrets(secrets)];

  // Create each MCP server as a separate Lambda
  const servers = {} as Record<MCPServerName, sst.aws.Function>;

  for (const [name, config] of Object.entries(MCP_SERVER_CONFIGS)) {
    const serverName = name as MCPServerName;
    const pascalName = name
      .split('-')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('');

    servers[serverName] = new sst.aws.Function(`MCP${pascalName}Server`, {
      handler: config.handler,
      dev: liveInLocalOnly,
      link: baseLink,
      permissions: basePermissions,
      architecture: LAMBDA_ARCHITECTURE,
      nodejs: { loader: NODEJS_LOADERS },
      memory: config.memory,
      timeout: config.timeout,
      logging: {
        retention: LOG_RETENTION_PERIOD,
      },
      environment: {
        MCP_SERVER_NAME: name,
        PATH: process.env.PATH ?? '/var/lang/bin:/usr/local/bin:/usr/bin',
      },
      // Enable function URL for direct IAM-authenticated access
      url: {
        cors: {
          allowOrigins: ['*'],
          allowMethods: ['POST'],
          allowHeaders: ['Content-Type', 'Authorization'],
        },
      },
    });
  }

  return {
    servers,
  };
}
