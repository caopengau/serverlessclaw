import { INFRA_NODE_ID, MAPPING_PROFILE } from './constants';

/**
 * Maps a connection profile string to a canonical resource ID.
 *
 * @param profile The profile name (e.g., 'bus', 'memory').
 * @param busId The active bus ID for the environment.
 * @returns The target resource ID or null if not recognized.
 */
export function mapProfileToResource(profile: string, busId: string): string | null {
  const lowerProfile = profile.toLowerCase();

  if (lowerProfile === MAPPING_PROFILE.BUS || lowerProfile === INFRA_NODE_ID.AGENT_BUS)
    return busId;
  if (
    lowerProfile === MAPPING_PROFILE.MEMORY ||
    lowerProfile === INFRA_NODE_ID.MEMORY_TABLE ||
    lowerProfile === 'memorytable'
  )
    return INFRA_NODE_ID.MEMORY_TABLE;
  if (
    lowerProfile === MAPPING_PROFILE.CONFIG ||
    lowerProfile === INFRA_NODE_ID.CONFIG_TABLE ||
    lowerProfile === 'configtable'
  )
    return INFRA_NODE_ID.CONFIG_TABLE;
  if (
    lowerProfile === MAPPING_PROFILE.TRACE ||
    lowerProfile === INFRA_NODE_ID.TRACE_TABLE ||
    lowerProfile === 'tracetable'
  )
    return INFRA_NODE_ID.TRACE_TABLE;
  if (lowerProfile === MAPPING_PROFILE.STORAGE || lowerProfile === INFRA_NODE_ID.STAGING_BUCKET)
    return INFRA_NODE_ID.STAGING_BUCKET;
  if (
    lowerProfile === 'codebuild' ||
    lowerProfile === MAPPING_PROFILE.DEPLOYER ||
    lowerProfile === INFRA_NODE_ID.DEPLOYER
  )
    return INFRA_NODE_ID.DEPLOYER;
  if (lowerProfile === MAPPING_PROFILE.KNOWLEDGE || lowerProfile === INFRA_NODE_ID.KNOWLEDGE_BUCKET)
    return INFRA_NODE_ID.KNOWLEDGE_BUCKET;
  if (lowerProfile === INFRA_NODE_ID.SCHEDULER) return INFRA_NODE_ID.SCHEDULER;
  if (lowerProfile === INFRA_NODE_ID.NOTIFIER) return INFRA_NODE_ID.NOTIFIER;

  // MCP Servers (Unified Multiplexer fallback)
  const mcpMultiplexerId = 'mcp-multiplexer';
  const isMcpProfile = [
    'ast',
    'git',
    'filesystem',
    'google-search',
    'puppeteer',
    'fetch',
    'aws',
    'aws-s3',
  ].includes(lowerProfile);

  if (isMcpProfile) return mcpMultiplexerId;

  if (lowerProfile === MAPPING_PROFILE.SQS || lowerProfile === INFRA_NODE_ID.SQS)
    return INFRA_NODE_ID.SQS;
  if (lowerProfile === MAPPING_PROFILE.DOCS || lowerProfile === INFRA_NODE_ID.DOCUMENTS)
    return INFRA_NODE_ID.DOCUMENTS;
  if (lowerProfile === MAPPING_PROFILE.SEARCH || lowerProfile === INFRA_NODE_ID.OPEN_SEARCH)
    return INFRA_NODE_ID.OPEN_SEARCH;
  if (lowerProfile === MAPPING_PROFILE.API || lowerProfile === INFRA_NODE_ID.API)
    return INFRA_NODE_ID.WEBHOOK_API;

  return null;
}

// Lazy-loaded TOOLS reference to break circular dependency with tools/index
let _toolsCache: Record<string, { connectionProfile?: string[] }> | null = null;

/**
 * Loads and caches tool definitions asynchronously.
 */
async function getTools(): Promise<Record<string, { connectionProfile?: string[] }>> {
  if (!_toolsCache) {
    const { TOOLS } = await import('../../../tools/index');
    _toolsCache = TOOLS;
  }
  return _toolsCache;
}

/**
 * Maps a tool name to its connected resources based on its connection profile.
 *
 * @param toolName The name of the tool.
 * @returns An array of resource identifiers.
 */
export async function mapToolToResources(toolName: string): Promise<string[]> {
  if (!toolName) return [];
  const toolDefinitions = await getTools();
  const tool = toolDefinitions[toolName];
  const lowerName = toolName.toLowerCase();

  const resources: string[] = [];

  // Manual overrides for known core tools
  if (lowerName.includes('deploy') || lowerName.includes('infra'))
    resources.push(INFRA_NODE_ID.DEPLOYER);
  if (lowerName.includes('search')) resources.push(INFRA_NODE_ID.OPEN_SEARCH);
  if (lowerName.includes('memory') || lowerName.includes('recall'))
    resources.push(INFRA_NODE_ID.MEMORY_TABLE);
  if (lowerName.includes('metric')) resources.push(INFRA_NODE_ID.CLOUDWATCH);

  if (tool?.connectionProfile) {
    for (const profile of tool.connectionProfile) {
      const resId = mapProfileToResource(profile, 'bus'); // busId is placeholder here
      if (resId) resources.push(resId);
    }
  }

  return [...new Set(resources)];
}
