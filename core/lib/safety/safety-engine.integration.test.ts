/**
 * @module SafetyEngine Integration Tests
 * Tests cross-component safety evaluation with real state transitions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SafetyEngine } from './safety-engine';
import { SafetyTier, AgentCategory } from '../types/agent';
import { DEFAULT_POLICIES } from './safety-config';

// Mock Logger
vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock SafetyConfigManager
vi.mock('./safety-config-manager', () => ({
  SafetyConfigManager: {
    getPolicies: vi.fn(async () => DEFAULT_POLICIES),
    getPolicy: vi.fn(async (tier: SafetyTier) => DEFAULT_POLICIES[tier]),
  },
}));

describe('Safety Engine Integration', () => {
  let engine: SafetyEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new SafetyEngine();
  });

  describe('Cross-tier safety evaluation', () => {
    it('should enforce PROD tier requiring deployment approval', async () => {
      const config = {
        id: 'prod-agent',
        name: 'ProdAgent',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.PROD,
        description: 'test',
        category: AgentCategory.SYSTEM,
        icon: 'test',
        tools: [],
      };

      // deployment should require approval in PROD
      const result = await engine.evaluateAction(config, 'deployment');
      expect(result.requiresApproval).toBe(true);
      expect(result.appliedPolicy).toBe('prod_deployment_approval');
    });

    it('should allow LOCAL tier with no approvals for standard actions', async () => {
      const config = {
        id: 'local-agent',
        name: 'LocalAgent',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.LOCAL,
        description: 'test',
        category: AgentCategory.SYSTEM,
        icon: 'test',
        tools: [],
      };

      const actions = ['code_change', 'deployment', 'file_operation', 'shell_command', 'mcp_tool'];

      for (const action of actions) {
        const result = await engine.evaluateAction(config, action);
        expect(result.allowed).toBe(true);
        expect(result.requiresApproval).toBe(false);
      }
    });
  });

  describe('Resource protection integration', () => {
    it('should block protected files even for LOCAL agents', async () => {
      const config = {
        id: 'local-agent',
        name: 'LocalAgent',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.LOCAL,
      };

      const result = await engine.evaluateAction(config, 'file_operation', {
        resource: '.env.production',
        toolName: 'fileWrite',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('blocked');
      expect(result.appliedPolicy).toBe('blocked_resource');
    });

    it('should allow non-protected files for LOCAL agents', async () => {
      const config = {
        id: 'local-agent',
        name: 'LocalAgent',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.LOCAL,
      };

      const result = await engine.evaluateAction(config, 'file_operation', {
        resource: 'src/components/Button.tsx',
        toolName: 'fileWrite',
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('Rate limiting enforcement', () => {
    it('should enforce daily deployment limits', async () => {
      const { SafetyConfigManager } = await import('./safety-config-manager');
      const testPolicies = {
        [SafetyTier.PROD]: DEFAULT_POLICIES[SafetyTier.PROD],
        [SafetyTier.LOCAL]: {
          ...DEFAULT_POLICIES[SafetyTier.LOCAL],
          maxDeploymentsPerDay: 2,
        },
      };

      (SafetyConfigManager.getPolicies as any).mockResolvedValue(testPolicies);

      const testEngine = new SafetyEngine(testPolicies);
      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.LOCAL,
      };

      const result1 = await testEngine.evaluateAction(config, 'deployment');
      expect(result1.allowed).toBe(true);

      const result2 = await testEngine.evaluateAction(config, 'deployment');
      expect(result2.allowed).toBe(true);

      const result3 = await testEngine.evaluateAction(config, 'deployment');
      expect(result3.allowed).toBe(false);
      expect(result3.reason).toContain('rate limit');
    });

    it('should enforce shell command hourly limits', async () => {
      const { SafetyConfigManager } = await import('./safety-config-manager');
      const testPolicies = {
        [SafetyTier.PROD]: DEFAULT_POLICIES[SafetyTier.PROD],
        [SafetyTier.LOCAL]: {
          ...DEFAULT_POLICIES[SafetyTier.LOCAL],
          maxShellCommandsPerHour: 2,
        },
      };

      (SafetyConfigManager.getPolicies as any).mockResolvedValue(testPolicies);

      const testEngine = new SafetyEngine(testPolicies);
      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.LOCAL,
      };

      await testEngine.evaluateAction(config, 'shell_command');
      await testEngine.evaluateAction(config, 'shell_command');

      const result = await testEngine.evaluateAction(config, 'shell_command');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('rate limit');
    });
  });

  describe('Violation tracking across evaluations', () => {
    it('should accumulate violations from multiple evaluations', async () => {
      const config = {
        id: 'test-agent',
        name: 'TestAgent',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.PROD,
      };

      await engine.evaluateAction(config, 'code_change'); // Allowed in PROD
      await engine.evaluateAction(config, 'deployment'); // Requires approval in PROD
      await engine.evaluateAction(config, 'file_operation', { resource: '.env' }); // Blocked

      const violations = engine.getViolations();
      // Only deployment (approval required) and file_operation (blocked) should be violations
      expect(violations.length).toBe(2);

      const stats = engine.getStats();
      expect(stats.totalViolations).toBe(2);
    });

    it('should track blocked vs approval-required violations separately', async () => {
      const localConfig = {
        id: 'local-agent',
        name: 'LocalAgent',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.LOCAL,
      };

      await engine.evaluateAction(localConfig, 'file_operation', {
        resource: '.env',
      }); // Blocked

      const prodConfig = {
        id: 'prod-agent',
        name: 'ProdAgent',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.PROD,
      };

      await engine.evaluateAction(prodConfig, 'deployment'); // Approval required

      const stats = engine.getStats();
      expect(stats.blockedActions).toBe(1);
      expect(stats.approvalRequired).toBe(1);
    });
  });
});
