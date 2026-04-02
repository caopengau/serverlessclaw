/**
 * @module SafetyConfig Tests
 * @description Tests for default safety policies, blocked paths, and tier structure.
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_POLICIES } from './safety-config';
import { PROTECTED_FILES } from '../constants';
import { SafetyTier, SafetyPolicy } from '../types/agent';

describe('safety-config', () => {
  describe('COMMON_BLOCKED_PATHS', () => {
    it('contains expected paths', () => {
      expect(PROTECTED_FILES).toContain('.git/**');
      expect(PROTECTED_FILES).toContain('.env*');
      expect(PROTECTED_FILES).toContain('package-lock.json');
      expect(PROTECTED_FILES).toContain('pnpm-lock.yaml');
      expect(PROTECTED_FILES).toContain('node_modules/**');
    });

    it('has all required paths', () => {
      expect(PROTECTED_FILES.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('DEFAULT_POLICIES', () => {
    const tiers: SafetyTier[] = [SafetyTier.SANDBOX, SafetyTier.AUTONOMOUS];

    it('defines a policy for every tier', () => {
      for (const tier of tiers) {
        expect(DEFAULT_POLICIES[tier]).toBeDefined();
      }
    });

    it('has matching tier field on each policy', () => {
      for (const tier of tiers) {
        expect(DEFAULT_POLICIES[tier].tier).toBe(tier);
      }
    });

    it('includes all required SafetyPolicy fields on each tier', () => {
      const requiredFields: (keyof SafetyPolicy)[] = [
        'tier',
        'requireCodeApproval',
        'requireDeployApproval',
        'requireFileApproval',
        'requireShellApproval',
        'requireMcpApproval',
        'blockedFilePaths',
      ];

      for (const tier of tiers) {
        for (const field of requiredFields) {
          expect(DEFAULT_POLICIES[tier][field]).toBeDefined();
        }
      }
    });
  });

  describe('SANDBOX tier', () => {
    const policy = DEFAULT_POLICIES[SafetyTier.SANDBOX];

    it('requires approval for all actions', () => {
      expect(policy.requireCodeApproval).toBe(true);
      expect(policy.requireDeployApproval).toBe(true);
      expect(policy.requireFileApproval).toBe(true);
      expect(policy.requireShellApproval).toBe(true);
      expect(policy.requireMcpApproval).toBe(true);
    });

    it('has restrictive limits', () => {
      expect(policy.maxDeploymentsPerDay).toBe(2);
      expect(policy.maxShellCommandsPerHour).toBe(10);
      expect(policy.maxFileWritesPerHour).toBe(20);
    });

    it('includes blocked paths from COMMON_BLOCKED_PATHS', () => {
      expect(policy.blockedFilePaths).toEqual(expect.arrayContaining(PROTECTED_FILES));
    });

    it('has time restrictions for weekends', () => {
      expect(policy.timeRestrictions).toBeDefined();
      expect(policy.timeRestrictions).toHaveLength(1);

      const restriction = policy.timeRestrictions![0];
      expect(restriction.daysOfWeek).toEqual([0, 6]);
      expect(restriction.startHour).toBe(0);
      expect(restriction.endHour).toBe(23);
      expect(restriction.timezone).toBe('UTC');
      expect(restriction.restrictedActions).toContain('deployment');
      expect(restriction.restrictedActions).toContain('shell_command');
      expect(restriction.restrictionType).toBe('require_approval');
    });
  });

  describe('AUTONOMOUS tier', () => {
    const policy = DEFAULT_POLICIES[SafetyTier.AUTONOMOUS];

    it('does not require approval for any actions', () => {
      expect(policy.requireCodeApproval).toBe(false);
      expect(policy.requireDeployApproval).toBe(false);
      expect(policy.requireFileApproval).toBe(false);
      expect(policy.requireShellApproval).toBe(false);
      expect(policy.requireMcpApproval).toBe(false);
    });

    it('has generous limits', () => {
      expect(policy.maxDeploymentsPerDay).toBe(10);
      expect(policy.maxShellCommandsPerHour).toBe(200);
      expect(policy.maxFileWritesPerHour).toBe(500);
    });

    it('includes blocked paths from COMMON_BLOCKED_PATHS', () => {
      expect(policy.blockedFilePaths).toEqual(expect.arrayContaining(PROTECTED_FILES));
    });

    it('does not define time restrictions', () => {
      expect(policy.timeRestrictions).toBeUndefined();
    });
  });

  describe('tier escalation: SANDBOX is more restrictive than AUTONOMOUS', () => {
    const sandbox = DEFAULT_POLICIES[SafetyTier.SANDBOX];
    const autonomous = DEFAULT_POLICIES[SafetyTier.AUTONOMOUS];

    it('SANDBOX requires all approvals; AUTONOMOUS requires none', () => {
      const approvalFields: (keyof SafetyPolicy)[] = [
        'requireCodeApproval',
        'requireDeployApproval',
        'requireFileApproval',
        'requireShellApproval',
        'requireMcpApproval',
      ];

      for (const field of approvalFields) {
        expect(sandbox[field]).toBe(true);
        expect(autonomous[field]).toBe(false);
      }
    });

    it('SANDBOX has lower deployment limit', () => {
      expect(sandbox.maxDeploymentsPerDay).toBeLessThan(autonomous.maxDeploymentsPerDay!);
    });

    it('SANDBOX has lower shell command limit', () => {
      expect(sandbox.maxShellCommandsPerHour).toBeLessThan(autonomous.maxShellCommandsPerHour!);
    });

    it('SANDBOX has lower file write limit', () => {
      expect(sandbox.maxFileWritesPerHour).toBeLessThan(autonomous.maxFileWritesPerHour!);
    });

    it('SANDBOX has time restrictions; AUTONOMOUS does not', () => {
      expect(sandbox.timeRestrictions).toBeDefined();
      expect(autonomous.timeRestrictions).toBeUndefined();
    });
  });
});
