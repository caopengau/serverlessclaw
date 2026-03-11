import { Resource } from 'sst';
import { NextResponse } from 'next/server';
import { AgentRegistry } from '@claw/core/lib/registry';
import { discoverSystemTopology } from '@claw/core/handlers/monitor';

const INFRA_IDS = {
  BUS: 'bus',
  MEMORY: 'memory',
  CODEBUILD: 'codebuild',
  STORAGE: 'storage',
} as const;

const INFRA_LABELS = {
  BUS: 'EventBridge AgentBus',
  MEMORY: 'DynamoDB Memory',
  CODEBUILD: 'AWS CodeBuild',
  STORAGE: 'Staging Bucket',
} as const;

/**
 * GET handler for infrastructure topology.
 * Discovers and returns the system's infrastructure nodes and their relationships.
 * 
 * @returns A promise that resolves to a NextResponse containing the topology JSON.
 */
export async function GET(): Promise<NextResponse> {
  try {
    // 1. Try to load full system topology from DynamoDB (persisted by Build Monitor)
    const topology = await AgentRegistry.getFullTopology();
    if (topology && topology.nodes.length > 0) {
      return NextResponse.json(topology);
    }

    // 2. Fallback: Live Discovery (Crucial for Local Dev)
    console.log('No persisted topology found. Performing live discovery...');
    const liveTopology = await discoverSystemTopology();
    if (liveTopology && liveTopology.nodes.length > 0) {
      return NextResponse.json(liveTopology);
    }

    // 3. Last Resort Fallback (Should rarely be hit now)
    const dynamicInfra = await AgentRegistry.getInfraConfig();
    if (dynamicInfra && dynamicInfra.length > 0) {
      return NextResponse.json({ nodes: dynamicInfra, edges: [] });
    }

    // 4. Static Fallback for initial deployment
    const infraNodes = [];
    if (Resource.AgentBus) {
      infraNodes.push({ id: INFRA_IDS.BUS, type: 'bus', label: INFRA_LABELS.BUS });
    }
    if (Resource.MemoryTable) {
      infraNodes.push({ id: INFRA_IDS.MEMORY, type: 'infra', label: INFRA_LABELS.MEMORY });
    }
    infraNodes.push({ id: INFRA_IDS.CODEBUILD, type: 'infra', label: INFRA_LABELS.CODEBUILD });
    if (Resource.StagingBucket) {
      infraNodes.push({ id: INFRA_IDS.STORAGE, type: 'infra', label: INFRA_LABELS.STORAGE });
    }

    return NextResponse.json({ nodes: infraNodes, edges: [] });
  } catch (error) {
    console.error('Failed to fetch infrastructure:', error);
    return NextResponse.json({ error: 'Failed to fetch infrastructure' }, { status: 500 });
  }
}
