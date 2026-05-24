import { IAgentConfig, SafetyEvaluationResult, SafetyTier } from '../../types/agent';
import { TRUST } from '../../constants';
import { logger } from '../../logger';

/**
 * Checks for trust-driven permission escalation (SC-3.2).
 * Allows agents with high trust scores to bypass certain approval requirements.
 */
export async function checkTrustEscalation(
  config: Partial<IAgentConfig> | undefined,
  action: string,
  evaluation: SafetyEvaluationResult,
  ctx: Record<string, unknown>
): Promise<SafetyEvaluationResult | null> {
  const trustScore = config?.trustScore ?? TRUST.DEFAULT_SCORE;
  const tier = config?.safetyTier ?? SafetyTier.PROD;

  // Only escalate if the current evaluation requires approval
  if (evaluation.requiresApproval && trustScore >= TRUST.ESCALATION_THRESHOLD) {
    // Tier-based Escalation Logic:
    // - DEV/TEST: Always escalate if Trust >= 85
    // - PROD: Only escalate if Trust >= 90 and not a Class C action

    let shouldEscalate = false;
    if (tier === SafetyTier.DEV || tier === SafetyTier.TEST) {
      shouldEscalate = true;
    } else if (tier === SafetyTier.PROD && trustScore >= 90) {
      // For PROD, we are more conservative.
      // We don't auto-escalate Class C actions here (those handled by Principle 9 at 95)
      const isClassC = ctx.isClassC === true; // Assuming this is passed in context
      if (!isClassC) {
        shouldEscalate = true;
      }
    }

    if (shouldEscalate) {
      logger.info(
        `[SafetyEngine] SC-3.2: Trust-driven escalation for '${action}' (Agent: ${ctx.agentId}, TrustScore: ${trustScore}, Tier: ${tier})`
      );

      return {
        allowed: true,
        requiresApproval: false,
        reason: `${evaluation.reason} [TRUST ESCALATION: TrustScore >= ${TRUST.ESCALATION_THRESHOLD}]`,
        appliedPolicy: 'trust_escalation_sc32',
      };
    }
  }

  return null;
}
