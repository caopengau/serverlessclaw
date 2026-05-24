import { SafetyTier, SafetyEvaluationResult, UserRole } from '../../types/agent';
import { Permission } from '../../types/security';
import { CLASS_C_ACTIONS, CLASS_D_ACTIONS } from '../../constants/safety';
import { SecurityRegistry } from '../../registry/SecurityRegistry';

/**
 * Validates static policies (Class D blocks).
 */
export function validateStaticPolicies(
  action: string,
  ctx: Record<string, unknown>,
  tier: SafetyTier,
  handleViolation: (
    ctx: Record<string, unknown>,
    tier: SafetyTier,
    action: string,
    policy: string,
    reason: string
  ) => Promise<SafetyEvaluationResult>
): Promise<SafetyEvaluationResult> {
  if (CLASS_D_ACTIONS.map((a) => a.toLowerCase()).includes(action.toLowerCase())) {
    return handleViolation(
      ctx,
      tier,
      action,
      'class_d_blocked',
      `Class D action '${action}' permanently blocked for all roles by system policy.`
    );
  }
  return Promise.resolve({ allowed: true, requiresApproval: false });
}

/**
 * Validates role-based access control.
 */
export async function validateRBAC(
  action: string,
  ctx: {
    agentId: string;
    userId?: string;
    userRole?: UserRole | string;
    workspaceId?: string;
  },
  tier: SafetyTier,
  handleViolation: (
    ctx: Record<string, unknown>,
    tier: SafetyTier,
    action: string,
    policy: string,
    reason: string
  ) => Promise<SafetyEvaluationResult>
): Promise<SafetyEvaluationResult> {
  const role = ctx.userRole || 'viewer';

  // 1. Class C Check (Infrastructural/Sensitive)
  if (CLASS_C_ACTIONS.map((a) => a.toLowerCase()).includes(action.toLowerCase())) {
    const hasInfraAccess =
      SecurityRegistry.hasPermission(role, Permission.ACTION_INFRA) ||
      SecurityRegistry.hasPermission(role, Permission.MISSION_COMMAND);

    if (!hasInfraAccess) {
      return handleViolation(
        ctx,
        tier,
        action,
        'rbac_class_c_denied',
        `Class C action '${action}' requires elevated permissions (ACTION_INFRA or MISSION_COMMAND). Current role: ${role}.`
      );
    }
  }

  // 2. Class B Check (Standard Agentic Action)
  // Non-viewers (Member, Admin, Owner, or custom with AgentInvoke) can perform Class B.
  const canInvoke =
    SecurityRegistry.hasPermission(role, Permission.AGENT_INVOKE) ||
    SecurityRegistry.hasPermission(role, Permission.TASK_CREATE);

  if (!canInvoke) {
    return handleViolation(
      ctx,
      tier,
      action,
      'rbac_viewer_denied',
      `Action '${action}' denied for role '${role}'. Role lacks AGENT_INVOKE or TASK_CREATE permissions.`
    );
  }

  return { allowed: true, requiresApproval: false };
}
