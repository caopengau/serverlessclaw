import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolSecurityValidator } from './tool-security';
import { AgentRole, Permission } from '../session/identity';
import { EvolutionMode, SafetyTier } from '../types/agent';
import { AgentRegistry } from '../registry';

vi.mock('../registry', () => ({
  AgentRegistry: {
    getAgentConfig: vi.fn(),
  },
}));

vi.mock('../safety', () => ({
  getSafetyEngine: () => ({
    evaluateAction: vi.fn().mockResolvedValue({ allowed: true }),
    isClassCAction: () => false,
  }),
  getCircuitBreaker: () => ({
    canProceed: () => ({ allowed: true }),
  }),
}));

vi.mock('../session/identity', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    getIdentityManager: vi.fn().mockResolvedValue({
      hasPermission: vi.fn().mockResolvedValue(true), // User always has permission for these tests
      hasAgentPermission: async (agentId: string, perm: any, wsId: string) => {
        const { AgentRegistry: Registry } = await import('../registry');
        const config = await Registry.getAgentConfig(agentId, { workspaceId: wsId });
        if (!config) return false;
        const roles = config.roles || [actual.AgentRole.WORKER];
        const { AGENT_ROLE_PERMISSIONS } = await import('../session/identity/constants');
        return roles.some((role: any) => (AGENT_ROLE_PERMISSIONS as any)[role]?.includes(perm));
      },
    }),
  };
});

describe('Agent Role RBAC Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows tool execution when agent has the required role', async () => {
    const tool = {
      name: 'market_bid',
      requiredPermissions: [Permission.ACTION_FINANCIAL],
    } as any;

    const toolCall = {
      id: 'call-1',
      function: { name: 'market_bid', arguments: '{}' },
    } as any;

    const execContext = {
      agentId: 'trader-agent',
      userId: 'user-1',
      workspaceId: 'ws-1',
      agentConfig: { evolutionMode: EvolutionMode.HITL },
    } as any;

    vi.mocked(AgentRegistry.getAgentConfig).mockResolvedValue({
      id: 'trader-agent',
      roles: [AgentRole.TRADER],
      safetyTier: SafetyTier.PROD,
    } as any);

    const result = await ToolSecurityValidator.validate(tool, toolCall, {}, execContext);

    expect(result.allowed).toBe(true);
  });

  it('blocks tool execution when agent lacks the required role', async () => {
    const tool = {
      name: 'market_bid',
      requiredPermissions: [Permission.ACTION_FINANCIAL],
    } as any;

    const toolCall = {
      id: 'call-1',
      function: { name: 'market_bid', arguments: '{}' },
    } as any;

    const execContext = {
      agentId: 'worker-agent',
      userId: 'user-1',
      workspaceId: 'ws-1',
      agentConfig: { evolutionMode: EvolutionMode.HITL },
    } as any;

    vi.mocked(AgentRegistry.getAgentConfig).mockResolvedValue({
      id: 'worker-agent',
      roles: [AgentRole.WORKER], // Worker role doesn't have ACTION_FINANCIAL
      safetyTier: SafetyTier.PROD,
    } as any);

    const result = await ToolSecurityValidator.validate(tool, toolCall, {}, execContext);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('AGENT_ROLE_UNAUTHORIZED');
  });

  it('defaults to WORKER role if none specified in config', async () => {
    const tool = {
      name: 'dispatch_resource',
      requiredPermissions: [Permission.ACTION_DISPATCH],
    } as any;

    const toolCall = {
      id: 'call-1',
      function: { name: 'dispatch_resource', arguments: '{}' },
    } as any;

    const execContext = {
      agentId: 'plain-agent',
      userId: 'user-1',
      workspaceId: 'ws-1',
      agentConfig: {},
    } as any;

    vi.mocked(AgentRegistry.getAgentConfig).mockResolvedValue({
      id: 'plain-agent',
      // roles missing
    } as any);

    const result = await ToolSecurityValidator.validate(tool, toolCall, {}, execContext);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('AGENT_ROLE_UNAUTHORIZED');
  });

  it('allows SYSTEM agents to bypass specific checks if workspaceId is present', async () => {
    const tool = {
      name: 'critical_system_tool',
      requiredPermissions: [Permission.AGENT_CONTROL],
    } as any;

    const toolCall = {
      id: 'call-1',
      function: { name: 'critical_system_tool', arguments: '{}' },
    } as any;

    const execContext = {
      agentId: 'sys-agent',
      userId: 'SYSTEM',
      workspaceId: 'ws-1',
    } as any;

    vi.mocked(AgentRegistry.getAgentConfig).mockResolvedValue({
      id: 'sys-agent',
      roles: [AgentRole.SYSTEM],
    } as any);

    const result = await ToolSecurityValidator.validate(tool, toolCall, {}, execContext);
    expect(result.allowed).toBe(true);
  });
});
