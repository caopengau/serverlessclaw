import { Resource } from 'sst';
import { 
  SSTResource, 
  Topology, 
  TopologyNode, 
  TopologyEdge, 
  IAgentConfig 
} from '../types/index';
import { logger } from '../logger';

/**
 * Dynamically discovers the system topology by scanning SST Resources and the AgentRegistry.
 * Generates a graph of nodes and edges for the System Pulse dashboard.
 */
export async function discoverSystemTopology(): Promise<Topology> {
  try {
    const nodes: TopologyNode[] = [];
    const edges: TopologyEdge[] = [];

    // 1. Discover Infrastructure from SST Resource
    const resourceMap = Resource as unknown as Record<string, unknown>;
    const infraMap: Record<string, { id: string; type: string; label: string; iconType?: string }> = {
      AgentBus: { id: 'bus', type: 'bus', label: 'EventBridge AgentBus' },
      ConfigTable: { id: 'config', type: 'infra', label: 'DynamoDB Config', iconType: 'Database' },
      MemoryTable: { id: 'memory', type: 'infra', label: 'DynamoDB Memory', iconType: 'Database' },
      TraceTable: { id: 'trace', type: 'infra', label: 'DynamoDB Trace', iconType: 'Database' },
      StagingBucket: { id: 'storage', type: 'infra', label: 'Staging Bucket', iconType: 'Database' },
      Deployer: { id: 'codebuild', type: 'infra', label: 'AWS CodeBuild', iconType: 'Terminal' },
    };

    nodes.push({
      id: 'dashboard',
      type: 'dashboard',
      label: 'ClawCenter',
      description: 'Next.js management console for monitoring and evolving the system.',
    });

    nodes.push({
      id: 'api',
      type: 'infra',
      label: 'System API',
      iconType: 'Radio',
      description: 'Unified entry point for webhooks and dashboard interactions.',
    });

    nodes.push({
      id: 'monitor',
      type: 'infra',
      label: 'Build Monitor',
      iconType: 'Activity',
      description: 'Logic-based handler that watches for deployment signals and triggers rollbacks.',
    });

    Object.keys(infraMap).forEach((resKey) => {
      const actualKey = Object.keys(resourceMap).find(
        (k) => k === resKey || k.startsWith(`${resKey}Table`) || k.startsWith(resKey)
      );

      if (actualKey || resKey === 'Deployer') {
        const cfg = infraMap[resKey];
        nodes.push({
          id: cfg.id,
          type: cfg.type as 'infra',
          label: cfg.label,
          iconType: cfg.iconType,
          description: `AWS Resource: ${resKey}`,
        });
      }
    });

    // 2. Discover Agents from Registry
    const { AgentRegistry } = await import('../registry');
    let agents: Record<string, IAgentConfig> = {};
    try {
      agents = await AgentRegistry.getAllConfigs();
    } catch (e) {
      logger.error('Failed to load agents for topology, falling back to backbone.', e);
      const { BACKBONE_REGISTRY } = await import('../backbone');
      agents = BACKBONE_REGISTRY as Record<string, IAgentConfig>;
    }

    Object.values(agents).forEach((agent) => {
      nodes.push({
        id: agent.id,
        type: 'agent',
        label: agent.name,
        description: agent.description,
        icon: agent.icon,
        enabled: agent.enabled,
        isBackbone: agent.isBackbone,
      });

      if (agent.connectionProfile && agent.enabled) {
        agent.connectionProfile.forEach((targetId: string) => {
          let actualTarget = targetId;
          if (targetId === 'memoryTable') actualTarget = 'memory';
          if (targetId === 'configTable') actualTarget = 'config';
          if (targetId === 'stagingBucket') actualTarget = 'storage';
          if (targetId === 'deployer') actualTarget = 'codebuild';

          if (actualTarget === 'bus' || actualTarget === 'AgentBus') {
            if (agent.id === 'main') {
              edges.push({ id: `${agent.id}-bus`, source: agent.id, target: 'bus', label: 'ORCHESTRATE' });
            } else {
              edges.push({ id: `bus-${agent.id}`, source: 'bus', target: agent.id, label: 'SIGNAL' });
              edges.push({ id: `${agent.id}-bus`, source: agent.id, target: 'bus', label: 'RESULT' });
            }
          } else {
            edges.push({ id: `${agent.id}-${actualTarget}`, source: agent.id, target: actualTarget });
          }
        });
      }

      const hasBusConnection = agent.connectionProfile?.some((t: string) => t === 'bus' || t === 'AgentBus');
      if (!hasBusConnection && agent.id !== 'main' && agent.enabled) {
        edges.push({ id: `bus-${agent.id}`, source: 'bus', target: agent.id, label: 'SIGNAL' });
        edges.push({ id: `${agent.id}-bus`, source: agent.id, target: 'bus', label: 'RESULT' });
      }
    });

    // 3. Add Infrastructure Inflow Edges
    if (nodes.find((n) => n.id === 'codebuild') && nodes.find((n) => n.id === 'bus')) {
      edges.push({ id: 'codebuild-bus', source: 'codebuild', target: 'bus', label: 'SIGNAL_BUILD' });
    }
    if (nodes.find((n) => n.id === 'monitor') && nodes.find((n) => n.id === 'bus')) {
      edges.push({ id: 'monitor-bus', source: 'monitor', target: 'bus', label: 'SIGNAL_FAILURE' });
    }
    if (nodes.find((n) => n.id === 'dashboard') && nodes.find((n) => n.id === 'api')) {
      edges.push({ id: 'dashboard-api', source: 'dashboard', target: 'api' });
    }
    if (nodes.find((n) => n.id === 'api') && nodes.find((n) => n.id === 'main')) {
      edges.push({ id: 'api-main', source: 'api', target: 'main', label: 'INVOKE' });
    }
    if (nodes.find((n) => n.id === 'api')) {
      ['memory', 'config', 'storage', 'bus'].forEach((target) => {
        if (nodes.find((n) => n.id === target)) {
          edges.push({ id: `api-${target}`, source: 'api', target: target, label: target === 'bus' ? 'SIGNAL' : undefined });
        }
      });
    }

    return { nodes, edges };
  } catch (e) {
    logger.error('Failed to discover system topology:', e);
    return { nodes: [], edges: [] };
  }
}
