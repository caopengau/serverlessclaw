import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetSafetyEngine } from './safety-engine';
import { SafetyTier, IAgentConfig, EvolutionMode } from '../types/agent';
import { Permission } from '../session/identity/types';
import { SecurityRegistry } from '../registry/SecurityRegistry';

// Mock dependencies
vi.mock('./safety-config-manager', () => ({
  SafetyConfigManager: {
    getPolicies: vi.fn().mockResolvedValue({
      prod: { tier: 'prod', requireCodeApproval: true, requireDeployApproval: true },
      local: { tier: 'local', requireCodeApproval: false, requireDeployApproval: false },
    }),
  },
}));

vi.mock('./blast-radius-store', () => ({
  getBlastRadiusStore: vi.fn(() => ({
    getBlastRadius: vi.fn().mockResolvedValue({ count: 0, resourceCount: 0 }),
    recordAction: vi.fn().mockResolvedValue(undefined),
    canExecute: vi.fn().mockResolvedValue({ allowed: true }),
    incrementBlastRadius: vi.fn().mockResolvedValue({ count: 1 }),
  })),
}));

describe('SafetyEngine Dynamic RBAC', () => {
  let engine: any;
  const config = {
    id: 'test-agent',
    safetyTier: SafetyTier.LOCAL,
    trustScore: 90,
    evolutionMode: EvolutionMode.HITL,
  } as IAgentConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = resetSafetyEngine();
  });

  it('allows custom role to perform Class B actions if granted AGENT_INVOKE', async () => {
    const CUSTOM_ROLE = 'autonomous-operator';
    SecurityRegistry.registerRolePermissions(CUSTOM_ROLE, [Permission.AGENT_INVOKE]);

    const result = await engine.evaluateAction(config, 'any_action', {
      userRole: CUSTOM_ROLE,
    });
    expect(result.allowed).toBe(true);
  });

  it('denies custom role Class C actions if lacking INFRA permissions', async () => {
    const CUSTOM_ROLE = 'junior-dev';
    SecurityRegistry.registerRolePermissions(CUSTOM_ROLE, [Permission.AGENT_INVOKE]);

    const result = await engine.evaluateAction(config, 'deployment', {
      userRole: CUSTOM_ROLE,
    });
    expect(result.allowed).toBe(false);
    expect(result.appliedPolicy).toBe('rbac_class_c_denied');
  });

  it('allows custom role Class C actions if granted ACTION_INFRA', async () => {
    const CUSTOM_ROLE = 'infra-lead';
    SecurityRegistry.registerRolePermissions(CUSTOM_ROLE, [
        Permission.AGENT_INVOKE,
        Permission.ACTION_INFRA 
    ]);

    const result = await engine.evaluateAction(config, 'deployment', {
      userRole: CUSTOM_ROLE,
    });
    expect(result.allowed).toBe(true);
  });
});
