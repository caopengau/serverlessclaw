import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SafetyEngine } from './safety-engine';
import { SafetyTier, IAgentConfig, UserRole } from '../types/agent';

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('./safety-config-manager', () => {
  const defaults = {
    local: {
      tier: 'local',
      requireCodeApproval: false,
      requireDeployApproval: false,
      requireFileApproval: false,
      requireShellApproval: false,
      requireMcpApproval: false,
    },
    prod: {
      tier: 'prod',
      requireCodeApproval: true,
      requireDeployApproval: true,
      requireFileApproval: true,
      requireShellApproval: true,
      requireMcpApproval: true,
    },
  };
  return {
    DEFAULT_POLICIES: defaults,
    SafetyConfigManager: {
      getPolicies: vi.fn(async () => defaults),
    },
  };
});

describe('SafetyEngine Multi-tenant Isolation', () => {
  let engine: SafetyEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new SafetyEngine();
  });

  it('partitions policies by workspaceId', async () => {
    const config = { id: 'test-agent', safetyTier: SafetyTier.LOCAL } as IAgentConfig;

    // Initially, LOCAL allows everything
    const res1 = await engine.evaluateAction(config, 'shell_command', {
      workspaceId: 'ws1',
      userId: 'SYSTEM', userRole: UserRole.ADMIN,
    });
    expect(res1.allowed).toBe(true);

    // Update policy for ws1 to require shell approval
    engine.updatePolicy(SafetyTier.LOCAL, { requireShellApproval: true }, 'ws1');

    // ws1 should now be blocked (requires approval)
    const res2 = await engine.evaluateAction(config, 'shell_command', {
      workspaceId: 'ws1',
      userId: 'SYSTEM', userRole: UserRole.ADMIN,
    });
    expect(res2.requiresApproval).toBe(true);

    // ws2 should STILL be allowed (isolation check)
    const res3 = await engine.evaluateAction(config, 'shell_command', {
      workspaceId: 'ws2',
      userId: 'SYSTEM', userRole: UserRole.ADMIN,
    });
    expect(res3.allowed).toBe(true);
    expect(res3.requiresApproval).toBe(false);
  });

  it('partitions tool overrides by workspaceId', async () => {
    const ctx1 = { workspaceId: 'ws1', toolName: 'testTool', userId: 'SYSTEM' };
    const ctx2 = { workspaceId: 'ws2', toolName: 'testTool', userId: 'SYSTEM' };

    // Initially allowed
    expect((await engine.checkToolSafety(ctx1 as any, SafetyTier.LOCAL, 'exec')).allowed).toBe(
      true
    );
    expect((await engine.checkToolSafety(ctx2 as any, SafetyTier.LOCAL, 'exec')).allowed).toBe(
      true
    );

    // Override for ws1
    engine.setToolOverride({ toolName: 'testTool', requireApproval: true }, 'ws1');

    // ws1 blocked
    expect(
      (await engine.checkToolSafety(ctx1 as any, SafetyTier.LOCAL, 'exec')).requiresApproval
    ).toBe(true);

    // ws2 still allowed
    expect((await engine.checkToolSafety(ctx2 as any, SafetyTier.LOCAL, 'exec')).allowed).toBe(
      true
    );
  });

  it('correctly handles global overrides', async () => {
    const customEngine = new SafetyEngine(undefined, [
      { toolName: 'globalTool', requireApproval: true },
    ]);

    const ctx1 = { workspaceId: 'ws1', toolName: 'globalTool', userId: 'SYSTEM' };
    const ctx2 = { workspaceId: 'ws2', toolName: 'globalTool', userId: 'SYSTEM' };

    // Global override affects all workspaces unless overridden
    expect(
      (await customEngine.checkToolSafety(ctx1 as any, SafetyTier.LOCAL, 'exec')).requiresApproval
    ).toBe(true);
    expect(
      (await customEngine.checkToolSafety(ctx2 as any, SafetyTier.LOCAL, 'exec')).requiresApproval
    ).toBe(true);
  });
});
