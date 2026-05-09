/**
 * Shared audit and remediation types.
 */

export enum AuditSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export interface AuditFinding {
  id: string;
  type: string;
  severity: AuditSeverity | string;
  description: string;
  impact?: string;
  recommendation?: string;
  location?: string;
  metadata?: Record<string, unknown>;
  timestamp?: number;
}
