import { SafetyTier, SafetyEvaluationResult, UserRole } from '../../types/agent';
import { CLASS_C_ACTIONS, CLASS_D_ACTIONS } from '../../constants/safety';

/**
 * Validates static policies (Class D blocks).
 */
export function validateStaticPolicies(
  action: string,
  ctx: any,
  tier: SafetyTier,
  handleViolation: (
    ctx: any,
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
    userRole?: UserRole;
    workspaceId?: string;
  },
  tier: SafetyTier,
  handleViolation: (
    ctx: any,
    tier: SafetyTier,
    action: string,
    policy: string,
    reason: string
  ) => Promise<SafetyEvaluationResult>
): Promise<SafetyEvaluationResult> {
  const role = ctx.userRole;

  if (ctx.userId === 'SYSTEM') {
    if (!ctx.workspaceId) {
      return handleViolation(
        ctx,
        tier,
        action,
        'system_rbac_unscoped',
        `SYSTEM action '${action}' rejected: Missing mandatory workspaceId for background task.`
      );
    }
    return { allowed: true, requiresApproval: false };
  }

  if (CLASS_C_ACTIONS.map((a) => a.toLowerCase()).includes(action.toLowerCase())) {
    if (role !== UserRole.OWNER && role !== UserRole.ADMIN) {
      return handleViolation(
        ctx,
        tier,
        action,
        'rbac_class_c_denied',
        `Class C action '${action}' requires OWNER or ADMIN role. Current role: ${role}.`
      );
    }
  }

  if (role === UserRole.VIEWER || role === undefined) {
    return handleViolation(
      ctx,
      tier,
      action,
      'rbac_viewer_denied',
      `Action '${action}' denied for VIEWER role or missing role. Viewers have read-only access.`
    );
  }

  return { allowed: true, requiresApproval: false };
}
