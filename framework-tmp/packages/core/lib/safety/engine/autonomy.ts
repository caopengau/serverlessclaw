import { IAgentConfig, EvolutionMode, EventType, SafetyEvaluationResult } from '../../types/agent';
import { TRUST } from '../../constants';
import { logger } from '../../logger';
import { emitEvent } from '../../utils/bus';

/**
 * Checks for trust-driven autonomous promotion (Principle 9).
 */
export async function checkAutonomousPromotion(
  config: Partial<IAgentConfig> | undefined,
  action: string,
  approval: SafetyEvaluationResult,
  ctx: any
): Promise<SafetyEvaluationResult | null> {
  const trustScore = config?.trustScore ?? TRUST.DEFAULT_SCORE;
  const isAutoMode = config?.evolutionMode === EvolutionMode.AUTO;
  const hasTrust = trustScore >= TRUST.AUTONOMY_THRESHOLD;

  if (approval.requiresApproval && hasTrust) {
    if (isAutoMode) {
      logger.info(
        `[SafetyEngine] Principle 9: Self-promoting action '${action}' (Agent: ${ctx.agentId}, TrustScore: ${trustScore}, Mode: AUTO)`
      );
      await emitEvent('safety.principle9', EventType.SYSTEM_AUDIT_TRIGGER, {
        agentId: config?.id ?? 'unknown',
        workspaceId: ctx.workspaceId,
        teamId: ctx.teamId,
        staffId: ctx.staffId,
        orgId: ctx.orgId,
        action,
        trustScore,
        reason: `Trust-based autonomous promotion: trustScore >= 95`,
        timestamp: Date.now(),
      });
      return {
        allowed: true,
        requiresApproval: false,
        reason: `${approval.reason} [AUTONOMOUS PROMOTION: TrustScore >= 95 & AUTO mode]`,
        appliedPolicy: 'principle_9_promotion',
      };
    }
    approval.reason = `${approval.reason} [ADVISORY: Candidate for trust-based autonomy promotion (TrustScore >= 95). Shift to AUTO mode to enable.]`;
  }
  return null;
}
