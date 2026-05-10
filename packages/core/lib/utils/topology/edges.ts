import type { TopologyNode, TopologyEdge } from '../../types/index';
import { EDGE_LABEL, NODE_TYPE, INFRA_NODE_ID } from './constants';
import { BACKBONE_REGISTRY } from '../../backbone';
import { mapProfileToResource, mapToolToResources } from './mapping';

export { mapProfileToResource, mapToolToResources } from './mapping';
export { inferNodeEdges } from './inference';

/**
 * Infers edges based on backbone registry configuration.
 *
 * @param nodes List of identified topology nodes.
 * @returns A promise resolving to an array of backbone topology edges.
 */
export async function inferBackboneEdges(nodes: TopologyNode[]): Promise<TopologyEdge[]> {
  const edges: TopologyEdge[] = [];
  const busNode = nodes.find(
    (node) =>
      node.type === NODE_TYPE.BUS ||
      node.id === INFRA_NODE_ID.AGENT_BUS ||
      node.id === INFRA_NODE_ID.BUS ||
      node.label.toLowerCase().includes('bus')
  );
  const busId = busNode?.id ?? INFRA_NODE_ID.AGENT_BUS;

  for (const [id, config] of Object.entries(BACKBONE_REGISTRY)) {
    const lowerId = id.toLowerCase();

    if (config.connectionProfile) {
      for (const profile of config.connectionProfile) {
        const target = mapProfileToResource(profile, busId);
        if (target && nodes.some((node) => node.id === target)) {
          const edgeId = `${lowerId}-${target}-profile-link`;
          if (!edges.some((edge) => edge.id === edgeId)) {
            edges.push({ id: edgeId, source: lowerId, target, label: EDGE_LABEL.USE });
          }
        }
      }
    }

    if (config.tools) {
      for (const toolName of config.tools) {
        const targets = await mapToolToResources(toolName);
        for (const profile of targets) {
          const targetId = mapProfileToResource(profile, busId);
          if (targetId && nodes.some((node) => node.id === targetId)) {
            const edgeId = `${lowerId}-${targetId}-tool-link`;
            if (!edges.some((edge) => edge.id === edgeId)) {
              edges.push({ id: edgeId, source: lowerId, target: targetId, label: EDGE_LABEL.USE });
            }
          }
        }
      }
    }
  }

  return edges;
}
