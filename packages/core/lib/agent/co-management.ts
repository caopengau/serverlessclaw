export enum ProposalType {
  TOPOLOGY = 'TOPOLOGY',
  PROMPT = 'PROMPT',
  TRUST = 'TRUST',
}

export enum ProposalStatus {
  PENDING_HUMAN_APPROVAL = 'PENDING_HUMAN_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  AUTO_EXECUTED = 'AUTO_EXECUTED',
}

export interface AgentNode {
  agentId: string;
  role: string;
  systemPromptFragmentKeys: string[]; // Dynamic prompt segments to inherit
  tools: string[]; // Permitted tools (subject to SwarmGuard)
  nextNodes: string[]; // Allowed downstream routing nodes
  routingStrategy: 'AUTO' | 'CONSENSUS' | 'HUMAN_INTERVENTION';
}

export interface SwarmTopology {
  workspaceId: string;
  topologyName: string;
  entryNode: string;
  nodes: Record<string, AgentNode>;
  updatedAt: number;
  version: number;
}

export interface PromptFragment {
  workspaceId: string;
  fragmentKey: string; // e.g. "COGNITIVE_CRITIC", "COMPLIANCE_RESTRICTIONS"
  description: string;
  content: string; // The raw instruction prompt text
  updatedAt: number;
  version: number;
  authorId: string; // "user-id" or "agent-id" (Co-Manager)
}

export interface TrustConfig {
  workspaceId: string;
  anomalyTolerance: 'STRICT' | 'BALANCED' | 'PERMISSIVE';
  costCapPerRunUSD: number; // Maximum single-run cost threshold
  consecutiveFailureThreshold: number; // Reaching this triggers automatic HITL lock
  agentReputationalScores: Record<string, number>; // Dynamic ratings (0 to 100)
  updatedAt: number;
}

export interface SwarmProposal {
  workspaceId: string;
  proposalId: string;
  proposalType: ProposalType;
  status: ProposalStatus;
  proposedBy: string; // "user-id" or "agent-id"
  justification: string;
  topologyProposal?: {
    topologyName: string;
    nodes: Record<string, AgentNode>;
    entryNode: string;
  };
  promptProposal?: {
    fragmentKey: string;
    content: string;
  };
  trustProposal?: {
    anomalyTolerance?: 'STRICT' | 'BALANCED' | 'PERMISSIVE';
    costCapPerRunUSD?: number;
    consecutiveFailureThreshold?: number;
    agentReputationalScores?: Record<string, number>;
  };
  createdAt: number;
  updatedAt: number;
}
