import { describe, it, expect } from 'vitest';
import { SuperClaw } from './superclaw';
import { SafetyTier } from '../lib/types/agent';

describe('SuperClaw — Safety Tiers', () => {
  describe('requiresApproval', () => {
    it('sandbox requires approval for code changes', () => {
      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.SANDBOX,
      };
      expect(SuperClaw.requiresApproval(config, 'code_change')).toBe(true);
    });

    it('sandbox requires approval for deployments', () => {
      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.SANDBOX,
      };
      expect(SuperClaw.requiresApproval(config, 'deployment')).toBe(true);
    });

    it('staged does NOT require approval for code changes', () => {
      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.STAGED,
      };
      expect(SuperClaw.requiresApproval(config, 'code_change')).toBe(false);
    });

    it('staged requires approval for deployments', () => {
      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.STAGED,
      };
      expect(SuperClaw.requiresApproval(config, 'deployment')).toBe(true);
    });

    it('autonomous does NOT require approval for code changes', () => {
      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.AUTONOMOUS,
      };
      expect(SuperClaw.requiresApproval(config, 'code_change')).toBe(false);
    });

    it('autonomous does NOT require approval for deployments', () => {
      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        safetyTier: SafetyTier.AUTONOMOUS,
      };
      expect(SuperClaw.requiresApproval(config, 'deployment')).toBe(false);
    });

    it('defaults to staged when safetyTier is undefined', () => {
      const config = { id: 'test', name: 'Test', systemPrompt: '', enabled: true };
      expect(SuperClaw.requiresApproval(config, 'code_change')).toBe(false);
      expect(SuperClaw.requiresApproval(config, 'deployment')).toBe(true);
    });

    it('defaults to staged when config is undefined', () => {
      expect(SuperClaw.requiresApproval(undefined, 'code_change')).toBe(false);
      expect(SuperClaw.requiresApproval(undefined, 'deployment')).toBe(true);
    });
  });
});
