import { InsightCategory, InsightMetadata } from '../types/memory';

/**
 * Represents a proactive improvement proposal initiated by an agent.
 * Unlike gaps which are reactive (something failed), improvements are proactive (make it better).
 */
export interface ImprovementProposal {
  id: string;
  userId: string;
  sourceAgentId: string;
  category: InsightCategory.SYSTEM_IMPROVEMENT;
  title: string;
  description: string;
  proposedChange: string;
  expectedBenefit: string;
  metadata: InsightMetadata;
  status: 'draft' | 'proposed' | 'approved' | 'implemented' | 'rejected';
  createdAt: number;
}

/**
 * Event emitted when a new improvement is proposed.
 */
export interface ImprovementProposedEvent {
  proposal: ImprovementProposal;
  traceId?: string;
}
