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
    const tiers: SafetyTier[] = [SafetyTier.LOCAL, SafetyTier.PROD];

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

  describe('LOCAL tier', () => {
    const policy = DEFAULT_POLICIES[SafetyTier.LOCAL];

    it('does not require approval for any actions', () => {
      expect(policy.requireCodeApproval).toBe(false);
      expect(policy.requireDeployApproval).toBe(false);
      expect(policy.requireFileApproval).toBe(false);
      expect(policy.requireShellApproval).toBe(false);
      expect(policy.requireMcpApproval).toBe(false);
    });

    it('has generous limits', () => {
      expect(policy.maxDeploymentsPerDay).toBe(50);
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

  describe('PROD tier', () => {
    const policy = DEFAULT_POLICIES[SafetyTier.PROD];

    it('requires approval for deployments but not for code changes', () => {
      expect(policy.requireCodeApproval).toBe(false);
      expect(policy.requireDeployApproval).toBe(true);
      expect(policy.requireFileApproval).toBe(false);
      expect(policy.requireShellApproval).toBe(true);
      expect(policy.requireMcpApproval).toBe(true);
    });

    it('has moderate limits', () => {
      expect(policy.maxDeploymentsPerDay).toBe(10);
      expect(policy.maxShellCommandsPerHour).toBe(50);
      expect(policy.maxFileWritesPerHour).toBe(100);
    });

    it('includes blocked paths from COMMON_BLOCKED_PATHS', () => {
      expect(policy.blockedFilePaths).toEqual(expect.arrayContaining(PROTECTED_FILES));
    });

    it('has time restrictions for business hours', () => {
      expect(policy.timeRestrictions).toBeDefined();
      expect(policy.timeRestrictions).toHaveLength(1);

      const restriction = policy.timeRestrictions![0];
      expect(restriction.daysOfWeek).toEqual([1, 2, 3, 4, 5]);
      expect(restriction.startHour).toBe(9);
      expect(restriction.endHour).toBe(17);
      expect(restriction.timezone).toBe('America/New_York');
      expect(restriction.restrictedActions).toContain('deployment');
      expect(restriction.restrictionType).toBe('require_approval');
    });
  });

  describe('tier escalation: PROD is more restrictive than LOCAL', () => {
    const prod = DEFAULT_POLICIES[SafetyTier.PROD];
    const local = DEFAULT_POLICIES[SafetyTier.LOCAL];

    it('PROD requires deploy approval; LOCAL requires none', () => {
      expect(prod.requireDeployApproval).toBe(true);
      expect(local.requireDeployApproval).toBe(false);
    });

    it('PROD has lower deployment limit', () => {
      expect(prod.maxDeploymentsPerDay).toBeLessThan(local.maxDeploymentsPerDay!);
    });

    it('PROD has lower shell command limit', () => {
      expect(prod.maxShellCommandsPerHour).toBeLessThan(local.maxShellCommandsPerHour!);
    });

    it('PROD has lower file write limit', () => {
      expect(prod.maxFileWritesPerHour).toBeLessThan(local.maxFileWritesPerHour!);
    });

    it('PROD has time restrictions; LOCAL does not', () => {
      expect(prod.timeRestrictions).toBeDefined();
      expect(local.timeRestrictions).toBeUndefined();
    });
  });
});
