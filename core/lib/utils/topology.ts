import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { Topology, TopologyNode, TopologyEdge, IAgentConfig } from '../types/index';
import { ConfigManager } from '../registry/config';

const db = new DynamoDBClient({});

/**
 * Discovers the active system topology by scanning SST resources and Agent configs.
 */
export async function discoverSystemTopology(): Promise<Topology> {
  const nodes: TopologyNode[] = [
    { id: 'api', type: 'infra', label: 'API Gateway', icon: 'Globe' },
    { id: 'bus', type: 'infra', label: 'AgentBus', icon: 'MessageCircle' },
    { id: 'codebuild', type: 'infra', label: 'BuildEngine', icon: 'Hammer' },
    {
      id: 'config',
      type: 'infra',
      label: 'DynamoDB Config',
      icon: 'Database',
    },
    {
      id: 'memory',
      type: 'infra',
      label: 'DynamoDB Memory',
      icon: 'Database',
    },
    {
      id: 'storage',
      type: 'infra',
      label: 'Staging Bucket',
      icon: 'Database',
    },
    {
      id: 'traces',
      type: 'infra',
      label: 'DynamoDB Traces',
      icon: 'Database',
    },
  ];

  const edges: TopologyEdge[] = [
    { id: 'api-bus', source: 'api', target: 'bus', label: 'SIGNAL' },
    { id: 'bus-codebuild', source: 'bus', target: 'codebuild', label: 'DEPLOY' },
  ];

  try {
    const tableName = await ConfigManager.resolveTableName();
    if (!tableName) return { nodes, edges };

    const { Items = [] } = await db.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: 'begins_with(id, :p)',
        ExpressionAttributeValues: { ':p': { S: 'agent' } },
      })
    );

    for (const item of Items) {
      const agent = (item.config?.M ? item.config.M : {}) as unknown as IAgentConfig;
      if (!agent.id) continue;

      nodes.push({
        id: agent.id,
        type: 'agent',
        label: agent.name || agent.id,
        icon: agent.isBackbone ? 'Brain' : 'Cpu',
      });

      edges.push({
        id: `${agent.id}-bus`,
        source: agent.id,
        target: 'bus',
        label: 'ORCHESTRATE',
      });
      edges.push({
        id: `bus-${agent.id}`,
        source: 'bus',
        target: agent.id,
        label: 'SIGNAL',
      });

      if (agent.tools && Array.isArray(agent.tools)) {
        for (const tool of agent.tools) {
          const actualTarget = tool === 'bus' || tool === 'AgentBus' ? 'bus' : 'storage';
          edges.push({
            id: `${agent.id}-${actualTarget}`,
            source: agent.id,
            target: actualTarget,
          });
        }
      }
    }
  } catch (err) {
    console.error('Failed to discover system topology:', err);
  }

  return { nodes, edges };
}
