import { SafetyTier, SafetyEvaluationResult, SafetyPolicy, IAgentConfig } from '../../types/agent';
import { scanForResources } from '../../utils/fs-security';

/**
 * Validates resource-level access and tool safety overrides.
 */
export async function validateAccessControl(
  agentConfig: Partial<IAgentConfig> | undefined,
  action: string,
  ctx: any,
  tier: SafetyTier,
  policy: SafetyPolicy,
  engine: any,
  validator: any
): Promise<SafetyEvaluationResult> {
  // 1. Tool Safety
  const toolResult = await engine.checkToolSafety(ctx, tier, action);
  if (!toolResult.allowed || toolResult.requiresApproval) return toolResult;

  // 2. Resource Discovery
  const discovered = scanForResources(ctx.args ?? {}, ctx.pathKeys);
  const resources = new Set(discovered.map((d) => d.path));
  if (ctx.resource) resources.add(ctx.resource);

  // 3. Resource-Level Validation
  for (const res of resources) {
    const resResult = await validator.checkResourceAccess(policy, res, action, tier, ctx);

    // System Protection Escalation
    if (
      resResult.allowed &&
      agentConfig?.manuallyApproved !== true &&
      engine.isSystemProtected(res)
    ) {
      return engine.handleViolation(
        ctx,
        tier,
        action,
        'system_protection',
        `Access to protected system resource '${res}' is blocked. Direct manipulation requires manual approval.`,
        'blocked',
        res
      );
    }
    if (!resResult.allowed || resResult.requiresApproval) return resResult;
  }

  return { allowed: true, requiresApproval: false };
}
