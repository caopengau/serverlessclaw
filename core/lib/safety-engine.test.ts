/**
 * @module SafetyEngine Tests
 * @description Comprehensive tests for the granular safety tier engine.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SafetyEngine } from './safety-engine';
import { SafetyTier } from './types/agent';

// Mock logger
vi.mock('./logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('SafetyEngine', () => {
  let engine: SafetyEngine;

  beforeEach(() => {
    engine = new SafetyEngine();
    engine.clearViolations();
  });

  describe('Tier-based approval', () => {
    it('should require all approvals in SANDBOX tier', () => {
      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.SANDBOX,
      };

      const codeResult = engine.evaluateAction(config, 'code_change');
      expect(codeResult.requiresApproval).toBe(true);

      const deployResult = engine.evaluateAction(config, 'deployment');
      expect(deployResult.requiresApproval).toBe(true);

      const fileResult = engine.evaluateAction(config, 'file_operation');
      expect(fileResult.requiresApproval).toBe(true);

      const shellResult = engine.evaluateAction(config, 'shell_command');
      expect(shellResult.requiresApproval).toBe(true);

      const mcpResult = engine.evaluateAction(config, 'mcp_tool');
      expect(mcpResult.requiresApproval).toBe(true);
    });

    it('should only require deployment approval in STAGED tier', () => {
      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.STAGED,
      };

      const codeResult = engine.evaluateAction(config, 'code_change');
      expect(codeResult.requiresApproval).toBe(false);
      expect(codeResult.allowed).toBe(true);

      const deployResult = engine.evaluateAction(config, 'deployment');
      expect(deployResult.requiresApproval).toBe(true);

      const fileResult = engine.evaluateAction(config, 'file_operation');
      expect(fileResult.requiresApproval).toBe(false);

      const shellResult = engine.evaluateAction(config, 'shell_command');
      expect(shellResult.requiresApproval).toBe(false);
    });

    it('should require no approvals in AUTONOMOUS tier', () => {
      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.AUTONOMOUS,
      };

      const codeResult = engine.evaluateAction(config, 'code_change');
      expect(codeResult.requiresApproval).toBe(false);
      expect(codeResult.allowed).toBe(true);

      const deployResult = engine.evaluateAction(config, 'deployment');
      expect(deployResult.requiresApproval).toBe(false);

      const fileResult = engine.evaluateAction(config, 'file_operation');
      expect(fileResult.requiresApproval).toBe(false);

      const shellResult = engine.evaluateAction(config, 'shell_command');
      expect(shellResult.requiresApproval).toBe(false);
    });

    it('should default to STAGED when no tier is specified', () => {
      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
      };

      const deployResult = engine.evaluateAction(config, 'deployment');
      expect(deployResult.requiresApproval).toBe(true);

      const codeResult = engine.evaluateAction(config, 'code_change');
      expect(codeResult.requiresApproval).toBe(false);
    });
  });

  describe('Resource-level controls', () => {
    it('should block access to .git files', () => {
      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.AUTONOMOUS,
      };

      const result = engine.evaluateAction(config, 'file_operation', {
        resource: '.git/config',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('blocked');
    });

    it('should block access to .env files', () => {
      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.AUTONOMOUS,
      };

      const result = engine.evaluateAction(config, 'file_operation', {
        resource: '.env.local',
      });

      expect(result.allowed).toBe(false);
    });

    it('should block access to lock files', () => {
      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.AUTONOMOUS,
      };

      const lockResult = engine.evaluateAction(config, 'file_operation', {
        resource: 'package-lock.json',
      });
      expect(lockResult.allowed).toBe(false);

      const pnpmResult = engine.evaluateAction(config, 'file_operation', {
        resource: 'pnpm-lock.yaml',
      });
      expect(pnpmResult.allowed).toBe(false);
    });

    it('should block access to node_modules', () => {
      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.AUTONOMOUS,
      };

      const result = engine.evaluateAction(config, 'file_operation', {
        resource: 'node_modules/some-package/index.js',
      });

      expect(result.allowed).toBe(false);
    });

    it('should allow access to regular source files', () => {
      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.AUTONOMOUS,
      };

      const result = engine.evaluateAction(config, 'file_operation', {
        resource: 'src/app.ts',
      });

      expect(result.allowed).toBe(true);
      expect(result.requiresApproval).toBe(false);
    });
  });

  describe('Tool-specific overrides', () => {
    it('should enforce tool-level approval requirement', () => {
      engine.setToolOverride({
        toolName: 'dangerousTool',
        requireApproval: true,
      });

      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.AUTONOMOUS,
      };

      const result = engine.evaluateAction(config, 'some_action', {
        toolName: 'dangerousTool',
      });

      expect(result.requiresApproval).toBe(true);
      expect(result.reason).toContain('dangerousTool');
    });

    it('should enforce tool-specific hourly rate limits', () => {
      engine.setToolOverride({
        toolName: 'limitedTool',
        maxUsesPerHour: 2,
      });

      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.AUTONOMOUS,
      };

      const result1 = engine.evaluateAction(config, 'action', { toolName: 'limitedTool' });
      expect(result1.allowed).toBe(true);

      const result2 = engine.evaluateAction(config, 'action', { toolName: 'limitedTool' });
      expect(result2.allowed).toBe(true);

      const result3 = engine.evaluateAction(config, 'action', { toolName: 'limitedTool' });
      expect(result3.allowed).toBe(false);
      expect(result3.reason).toContain('rate limit');
    });

    it('should remove tool override', () => {
      engine.setToolOverride({
        toolName: 'tempTool',
        requireApproval: true,
      });

      engine.removeToolOverride('tempTool');

      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.AUTONOMOUS,
      };
      const result = engine.evaluateAction(config, 'code_change', { toolName: 'tempTool' });

      expect(result.requiresApproval).toBe(false);
    });
  });

  describe('Rate limiting', () => {
    it('should enforce deployment daily limits', () => {
      engine.updatePolicy(SafetyTier.AUTONOMOUS, { maxDeploymentsPerDay: 2 });
      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.AUTONOMOUS,
      };

      const result1 = engine.evaluateAction(config, 'deployment');
      expect(result1.allowed).toBe(true);

      const result2 = engine.evaluateAction(config, 'deployment');
      expect(result2.allowed).toBe(true);

      const result3 = engine.evaluateAction(config, 'deployment');
      expect(result3.allowed).toBe(false);
      expect(result3.reason).toContain('rate limit');
    });

    it('should enforce shell command hourly limits', () => {
      engine.updatePolicy(SafetyTier.AUTONOMOUS, { maxShellCommandsPerHour: 2 });
      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.AUTONOMOUS,
      };

      engine.evaluateAction(config, 'shell_command');
      engine.evaluateAction(config, 'shell_command');
      const result = engine.evaluateAction(config, 'shell_command');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Shell command rate limit');
    });

    it('should enforce file write hourly limits', () => {
      engine.updatePolicy(SafetyTier.AUTONOMOUS, { maxFileWritesPerHour: 1 });
      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.AUTONOMOUS,
      };

      engine.evaluateAction(config, 'file_operation');
      const result = engine.evaluateAction(config, 'file_operation');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('File write rate limit');
    });
  });

  describe('Custom policies', () => {
    it('should apply custom policy overrides', () => {
      const customEngine = new SafetyEngine({
        [SafetyTier.AUTONOMOUS]: {
          requireDeployApproval: true,
        },
      });

      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.AUTONOMOUS,
      };
      const result = customEngine.evaluateAction(config, 'deployment');

      expect(result.requiresApproval).toBe(true);
    });
  });

  describe('Violation logging', () => {
    it('should log blocked actions', () => {
      const config = {
        id: 'agent1',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.AUTONOMOUS,
      };

      engine.evaluateAction(config, 'file_operation', {
        resource: '.env',
        traceId: 'trace123',
        userId: 'user1',
      });

      const violations = engine.getViolations();
      expect(violations.length).toBe(1);
      expect(violations[0].agentId).toBe('agent1');
      expect(violations[0].outcome).toBe('blocked');
      expect(violations[0].traceId).toBe('trace123');
      expect(violations[0].userId).toBe('user1');
    });

    it('should log approval-required actions', () => {
      const config = {
        id: 'agent1',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.SANDBOX,
      };

      engine.evaluateAction(config, 'code_change');

      const violations = engine.getViolations();
      expect(violations.length).toBe(1);
      expect(violations[0].outcome).toBe('approval_required');
    });

    it('should filter violations by agent', () => {
      const config1 = {
        id: 'agent1',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.SANDBOX,
      };
      const config2 = {
        id: 'agent2',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.SANDBOX,
      };

      engine.evaluateAction(config1, 'code_change');
      engine.evaluateAction(config2, 'file_operation', { resource: '.env' });
      engine.evaluateAction(config1, 'file_operation');

      const agent1Violations = engine.getViolationsByAgent('agent1');
      expect(agent1Violations.length).toBe(2);

      const agent2Violations = engine.getViolationsByAgent('agent2');
      expect(agent2Violations.length).toBe(1);
    });

    it('should filter violations by action type', () => {
      const config = {
        id: 'agent1',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.SANDBOX,
      };

      engine.evaluateAction(config, 'code_change');
      engine.evaluateAction(config, 'deployment');
      engine.evaluateAction(config, 'code_change');

      const codeViolations = engine.getViolationsByAction('code_change');
      expect(codeViolations.length).toBe(2);

      const deployViolations = engine.getViolationsByAction('deployment');
      expect(deployViolations.length).toBe(1);
    });

    it('should generate violation statistics', () => {
      const config1 = {
        id: 'agent1',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.SANDBOX,
      };
      const config2 = {
        id: 'agent2',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.AUTONOMOUS,
      };

      engine.evaluateAction(config1, 'code_change');
      engine.evaluateAction(config1, 'deployment');
      engine.evaluateAction(config2, 'file_operation', { resource: '.env' });

      const stats = engine.getStats();

      expect(stats.totalViolations).toBe(3);
      expect(stats.approvalRequired).toBe(2);
      expect(stats.blockedActions).toBe(1);
      expect(stats.byTier[SafetyTier.SANDBOX]).toBe(2);
      expect(stats.byTier[SafetyTier.AUTONOMOUS]).toBe(1);
    });

    it('should clear violations', () => {
      const config = {
        id: 'agent1',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.SANDBOX,
      };
      engine.evaluateAction(config, 'code_change');

      expect(engine.getViolations().length).toBe(1);

      engine.clearViolations();

      expect(engine.getViolations().length).toBe(0);
    });
  });

  describe('Glob pattern matching', () => {
    it('should match ** wildcards', () => {
      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.AUTONOMOUS,
      };

      const result1 = engine.evaluateAction(config, 'file_operation', {
        resource: 'node_modules/pkg/sub/file.js',
      });
      expect(result1.allowed).toBe(false);

      const result2 = engine.evaluateAction(config, 'file_operation', {
        resource: '.git/objects/abc',
      });
      expect(result2.allowed).toBe(false);
    });

    it('should match * wildcards', () => {
      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.AUTONOMOUS,
      };

      const result = engine.evaluateAction(config, 'file_operation', {
        resource: '.env.production',
      });
      expect(result.allowed).toBe(false);
    });
  });
});
