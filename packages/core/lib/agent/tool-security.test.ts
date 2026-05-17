import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolSecurityValidator } from './tool-security';
import { SafetyTier, EvolutionMode } from '../types/agent';

// Mock SafetyEngine
const mockEvaluateAction = vi.fn().mockResolvedValue({ allowed: true, reason: 'Allowed' });

const { MockSafetyEngine } = vi.hoisted(() => {
  return {
    MockSafetyEngine: class {
      evaluateAction = mockEvaluateAction;
    },
  };
});

vi.mock('../safety', () => ({
  SafetyEngine: MockSafetyEngine,
  getSafetyEngine: () => new MockSafetyEngine(),
  getCircuitBreaker: () => ({
    canProceed: vi.fn().mockResolvedValue({ allowed: true }),
  }),
}));

// Mock IdentityManager
const mockHasPermission = vi.fn().mockResolvedValue(true);
const mockHasAgentPermission = vi.fn().mockResolvedValue(true);
vi.mock('../session/identity', () => ({
  IdentityManager: class {
    hasPermission = mockHasPermission;
    hasAgentPermission = mockHasAgentPermission;
  },
  getIdentityManager: () =>
    Promise.resolve({
      hasPermission: mockHasPermission,
      hasAgentPermission: mockHasAgentPermission,
    }),
}));

// Mock SwarmGuard ToolPolicyManager
const mockGetPolicy = vi.fn().mockResolvedValue(null);
vi.mock('./tool-policy-manager', () => ({
  ToolPolicyManager: {
    getPolicy: mockGetPolicy,
    savePolicy: vi.fn(),
    deletePolicy: vi.fn(),
  },
}));

vi.mock('../memory/base', () => ({
  BaseMemoryProvider: class {},
}));

describe('ToolSecurityValidator', () => {
  const mockTool = {
    name: 'test_tool',
    description: 'test',
    requiredPermissions: [],
  } as any;

  const mockToolCall = {
    id: 'call-1',
    function: { name: 'test_tool', arguments: '{}' },
  } as any;

  const mockExecContext = {
    agentId: 'agent-1',
    userId: 'user-1',
    workspaceId: 'ws-1',
    traceId: 'trace-1',
    agentConfig: { safetyTier: SafetyTier.PROD, evolutionMode: EvolutionMode.HITL },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows safe actions in HITL mode', async () => {
    const result = await ToolSecurityValidator.validate(
      mockTool,
      mockToolCall,
      {},
      mockExecContext
    );
    expect(result.allowed).toBe(true);
  });

  it('blocks unsafe actions in HITL mode', async () => {
    mockEvaluateAction.mockResolvedValueOnce({ allowed: false, reason: 'Unsafe' });
    const result = await ToolSecurityValidator.validate(
      mockTool,
      mockToolCall,
      {},
      mockExecContext
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('PERMISSION_DENIED');
  });

  it('requires approval when safety engine flags it', async () => {
    mockEvaluateAction.mockResolvedValueOnce({
      allowed: true,
      requiresApproval: true,
      reason: 'Sensitive',
    });
    const result = await ToolSecurityValidator.validate(
      mockTool,
      mockToolCall,
      {},
      mockExecContext
    );
    expect(result.allowed).toBe(false);
    expect(result.requiresApproval).toBe(true);
  });

  it('allows sensitive actions in AUTO mode IF safety engine promotes them', async () => {
    const autoContext = {
      ...mockExecContext,
      agentConfig: { ...mockExecContext.agentConfig, evolutionMode: EvolutionMode.AUTO },
    };
    // If SafetyEngine cleared requiresApproval (Principle 9 promotion), it should be allowed
    mockEvaluateAction.mockResolvedValueOnce({ allowed: true, requiresApproval: false });

    const result = await ToolSecurityValidator.validate(mockTool, mockToolCall, {}, autoContext);
    expect(result.allowed).toBe(true);
    expect(result.modifiedArgs?.manuallyApproved).toBe(true);
  });

  it('still requires approval in AUTO mode if safety engine explicitly mandates it', async () => {
    const autoContext = {
      ...mockExecContext,
      agentConfig: { ...mockExecContext.agentConfig, evolutionMode: EvolutionMode.AUTO },
    };
    // If SafetyEngine STAYS requiresApproval: true, we must respect it even in AUTO mode
    mockEvaluateAction.mockResolvedValueOnce({ allowed: true, requiresApproval: true });

    const result = await ToolSecurityValidator.validate(mockTool, mockToolCall, {}, autoContext);
    expect(result.allowed).toBe(false);
    expect(result.requiresApproval).toBe(true);
  });

  it('enforces RBAC permissions', async () => {
    const permTool = { ...mockTool, requiredPermissions: ['admin'] };
    mockHasPermission.mockResolvedValueOnce(false);

    const result = await ToolSecurityValidator.validate(
      permTool,
      mockToolCall,
      {},
      mockExecContext
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Unauthorized');
  });

  describe('SwarmGuard Dynamic Policies', () => {
    it('blocks execution if agent is not in dynamic allowedAgents whitelist', async () => {
      // Setup dynamic policy with allowedAgents restriction
      mockGetPolicy.mockResolvedValueOnce({
        workspaceId: 'ws-1',
        toolName: 'test_tool',
        riskRating: 'CRITICAL',
        requiredPermissions: [],
        allowedAgents: ['agent-deployer-only'], // agent-1 is NOT this agent
        approvalStrategy: 'AUTO',
        updatedAt: Date.now(),
      });

      const result = await ToolSecurityValidator.validate(
        mockTool,
        mockToolCall,
        {},
        mockExecContext
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('AGENT_CONTAINMENT_BLOCK');
    });

    it('allows execution if agent is in dynamic allowedAgents whitelist', async () => {
      mockGetPolicy.mockResolvedValueOnce({
        workspaceId: 'ws-1',
        toolName: 'test_tool',
        riskRating: 'CRITICAL',
        requiredPermissions: [],
        allowedAgents: ['agent-1'], // agent-1 IS this agent
        approvalStrategy: 'AUTO',
        updatedAt: Date.now(),
      });

      const result = await ToolSecurityValidator.validate(
        mockTool,
        mockToolCall,
        {},
        mockExecContext
      );
      expect(result.allowed).toBe(true);
    });

    it('blocks command shell if dynamic constraints blacklist is violated', async () => {
      mockGetPolicy.mockResolvedValueOnce({
        workspaceId: 'ws-1',
        toolName: 'test_tool',
        riskRating: 'CRITICAL',
        requiredPermissions: [],
        approvalStrategy: 'AUTO',
        constraints: {
          commandBlacklist: ['rm -rf', 'sudo'],
        },
        updatedAt: Date.now(),
      });

      // Try calling with a blacklisted command
      const result = await ToolSecurityValidator.validate(
        mockTool,
        mockToolCall,
        { command: 'sudo rm -rf /' },
        mockExecContext
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('CONTAINMENT_VIOLATION');
    });

    it('blocks file writes outside whitelisted directory paths', async () => {
      mockGetPolicy.mockResolvedValueOnce({
        workspaceId: 'ws-1',
        toolName: 'test_tool',
        riskRating: 'HIGH',
        requiredPermissions: [],
        approvalStrategy: 'AUTO',
        constraints: {
          allowedDirectories: ['/Users/pengcao/projects/serverlessclaw/allowed'],
        },
        updatedAt: Date.now(),
      });

      // Path outside the whitelist (e.g., path traversal bypass)
      const result = await ToolSecurityValidator.validate(
        mockTool,
        mockToolCall,
        { filePath: '/Users/pengcao/projects/serverlessclaw/forbidden/config.json' },
        mockExecContext
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('CONTAINMENT_VIOLATION');
    });

    it('allows file writes inside whitelisted directory paths', async () => {
      mockGetPolicy.mockResolvedValueOnce({
        workspaceId: 'ws-1',
        toolName: 'test_tool',
        riskRating: 'HIGH',
        requiredPermissions: [],
        approvalStrategy: 'AUTO',
        constraints: {
          allowedDirectories: ['/Users/pengcao/projects/serverlessclaw/allowed'],
        },
        updatedAt: Date.now(),
      });

      // Path inside the whitelist
      const result = await ToolSecurityValidator.validate(
        mockTool,
        mockToolCall,
        { filePath: '/Users/pengcao/projects/serverlessclaw/allowed/config.json' },
        mockExecContext
      );
      expect(result.allowed).toBe(true);
    });
  });
});
