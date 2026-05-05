import { ConfigManager } from '../../registry/config';
import { EscalationPolicy, DEFAULT_ESCALATION_POLICY } from '../../types/escalation';
import { logger } from '../../logger';

const ESCALATION_POLICY_PREFIX = 'ESCALATION_POLICY#';

/**
 * Logic for retrieving and saving escalation policies.
 */
export class EscalationPolicyHandler {
  async getPolicy(userId: string, priority: string = 'medium'): Promise<EscalationPolicy> {
    try {
      const userPolicyKey = `${ESCALATION_POLICY_PREFIX}${userId}_${priority}`;
      const userPolicy = await ConfigManager.getRawConfig(userPolicyKey);
      if (userPolicy) return userPolicy as EscalationPolicy;

      const globalPolicyKey = `${ESCALATION_POLICY_PREFIX}global_${priority}`;
      const globalPolicy = await ConfigManager.getRawConfig(globalPolicyKey);
      if (globalPolicy) return globalPolicy as EscalationPolicy;

      return DEFAULT_ESCALATION_POLICY;
    } catch (error) {
      logger.warn(`Failed to get escalation policy for ${userId}:`, error);
      return DEFAULT_ESCALATION_POLICY;
    }
  }

  async savePolicy(userId: string | 'global', policy: EscalationPolicy): Promise<void> {
    const key =
      userId === 'global'
        ? `${ESCALATION_POLICY_PREFIX}global_${policy.priority}`
        : `${ESCALATION_POLICY_PREFIX}${userId}_${policy.priority}`;

    await ConfigManager.saveRawConfig(key, policy, {
      author: userId,
      description: `Escalation policy update for ${policy.name}`,
    });
    logger.info(`Saved escalation policy ${policy.id} for ${userId}`);
  }

  async getPolicyById(policyId: string): Promise<EscalationPolicy> {
    const policy = await ConfigManager.getRawConfig(`${ESCALATION_POLICY_PREFIX}${policyId}`);
    return (policy as EscalationPolicy) ?? DEFAULT_ESCALATION_POLICY;
  }
}
