import { Permission } from '../session/identity';

export enum RiskRating {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum ApprovalStrategy {
  AUTO = 'AUTO',
  SINGLE_ADMIN = 'SINGLE_ADMIN',
  QUORUM = 'QUORUM',
  SPECIFIC_ROSTER = 'SPECIFIC_ROSTER',
}

export interface ToolPolicy {
  workspaceId: string;
  toolName: string;
  riskRating: RiskRating;
  requiredPermissions: Permission[];
  allowedAgents?: string[]; // Whitelisted Agent IDs permitted to execute the tool
  approvalStrategy: ApprovalStrategy;
  quorumSize?: number; // Number of approvals required for QUORUM
  approverIds?: string[]; // Dedicated user IDs permitted to approve
  constraints?: {
    commandBlacklist?: string[]; // Denied terminal command substrings
    allowedDirectories?: string[]; // Whitelisted file write paths
    allowedHosts?: string[]; // Allowed network destinations
    /** Extensible payload constraints for product-specific spoke validation overlays. */
    custom?: Record<string, unknown>;
  };
  updatedAt: number;
}
