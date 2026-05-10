import { describe, it, expect } from 'vitest';
import { checkTrustEscalation } from './escalation';
import { TRUST } from '../../constants';
import { SafetyTier, SafetyEvaluationResult } from '../../types/agent';

describe('checkTrustEscalation', () => {
  const baseEvaluation: SafetyEvaluationResult = {
    allowed: false,
    requiresApproval: true,
    reason: 'Approval required',
  };

  it('should escalate in DEV tier if trust >= ESCALATION_THRESHOLD', async () => {
    const result = await checkTrustEscalation(
      { trustScore: 86, safetyTier: SafetyTier.DEV },
      'any_action',
      baseEvaluation,
      { agentId: 'agent-1' }
    );

    expect(result?.allowed).toBe(true);
    expect(result?.requiresApproval).toBe(false);
    expect(result?.appliedPolicy).toBe('trust_escalation_sc32');
  });

  it('should NOT escalate in PROD tier if trust < 90', async () => {
    const result = await checkTrustEscalation(
      { trustScore: 86, safetyTier: SafetyTier.PROD },
      'any_action',
      baseEvaluation,
      { agentId: 'agent-1' }
    );

    expect(result).toBeNull();
  });

  it('should escalate in PROD tier for non-Class C actions if trust >= 90', async () => {
    const result = await checkTrustEscalation(
      { trustScore: 91, safetyTier: SafetyTier.PROD },
      'minor_action',
      baseEvaluation,
      { agentId: 'agent-1', isClassC: false }
    );

    expect(result?.allowed).toBe(true);
  });

  it('should NOT escalate Class C actions in PROD (Principle 9 handles these at 95)', async () => {
    const result = await checkTrustEscalation(
      { trustScore: 91, safetyTier: SafetyTier.PROD },
      'major_action',
      baseEvaluation,
      { agentId: 'agent-1', isClassC: true }
    );

    expect(result).toBeNull();
  });
});
