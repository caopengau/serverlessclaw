import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentRouter, ModelTier } from './agent-router';
import { ReasoningProfile } from './types/llm';
import type { AgentReputation } from './memory/reputation-operations';

vi.mock('sst', () => ({
  Resource: {
    MemoryTable: { name: 'test-memory-table' },
    ConfigTable: { name: 'test-config-table' },
  },
}));

vi.mock('./logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AgentRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('selectModel', () => {
    it('should respect explicit provider/model overrides', () => {
      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        provider: 'openai',
        model: 'gpt-5.4',
      };

      const result = AgentRouter.selectModel(config);
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-5.4');
    });

    it('should select economy tier for FAST profile', () => {
      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        reasoningProfile: ReasoningProfile.FAST,
      };

      const result = AgentRouter.selectModel(config);
      expect(result.tier).toBe(ModelTier.ECONOMY);
    });

    it('should override tier based on budget constraint', () => {
      const config = {
        id: 'test',
        name: 'Test',
        systemPrompt: '',
        enabled: true,
        reasoningProfile: ReasoningProfile.DEEP,
      };

      const result = AgentRouter.selectModel(config, { budget: 'low' });
      expect(result.tier).toBe(ModelTier.ECONOMY);
    });
  });

  describe('computeScore', () => {
    it('should compute score from performance rollup', () => {
      const rollup = {
        agentId: 'coder',
        model: 'MiniMax-M2.7',
        avgInputTokens: 1000,
        avgOutputTokens: 500,
        successRate: 0.95,
        totalInvocations: 100,
        avgDurationMs: 3000,
      };

      const score = AgentRouter.computeScore(rollup, 1.0);
      // 1.0 * 0.95 - (1500 / 10000) = 0.95 - 0.15 = 0.80
      expect(score).toBeCloseTo(0.8, 2);
    });

    it('should default success rate to 0.5 for zero invocations', () => {
      const rollup = {
        agentId: 'new-agent',
        model: 'MiniMax-M2.7',
        avgInputTokens: 0,
        avgOutputTokens: 0,
        successRate: 0,
        totalInvocations: 0,
        avgDurationMs: 0,
      };

      const score = AgentRouter.computeScore(rollup, 1.0);
      // 1.0 * 0.5 - (0 / 10000) = 0.5
      expect(score).toBe(0.5);
    });
  });

  describe('selectBestAgent', () => {
    it('should return undefined for empty candidates', () => {
      const result = AgentRouter.selectBestAgent([]);
      expect(result).toBeUndefined();
    });

    it('should select the agent with highest composite score', () => {
      const candidates = [
        {
          agentId: 'coder',
          model: 'MiniMax-M2.7',
          avgInputTokens: 1000,
          avgOutputTokens: 500,
          successRate: 0.95,
          totalInvocations: 100,
          avgDurationMs: 3000,
        },
        {
          agentId: 'planner',
          model: 'MiniMax-M2.7',
          avgInputTokens: 5000,
          avgOutputTokens: 2000,
          successRate: 0.8,
          totalInvocations: 50,
          avgDurationMs: 8000,
        },
      ];

      const result = AgentRouter.selectBestAgent(candidates);
      expect(result).toBe('coder');
    });
  });

  describe('selectBestAgentWithReputation', () => {
    it('should return undefined for empty candidates', () => {
      const result = AgentRouter.selectBestAgentWithReputation([], new Map());
      expect(result).toBeUndefined();
    });

    it('should incorporate reputation into selection', () => {
      const candidates = [
        {
          agentId: 'coder-a',
          model: 'MiniMax-M2.7',
          avgInputTokens: 1000,
          avgOutputTokens: 500,
          successRate: 0.9,
          totalInvocations: 100,
          avgDurationMs: 3000,
        },
        {
          agentId: 'coder-b',
          model: 'MiniMax-M2.7',
          avgInputTokens: 1200,
          avgOutputTokens: 600,
          successRate: 0.85,
          totalInvocations: 80,
          avgDurationMs: 4000,
        },
      ];

      // coder-b has much better reputation
      const reputations = new Map<string, AgentReputation>([
        [
          'coder-a',
          {
            agentId: 'coder-a',
            tasksCompleted: 10,
            tasksFailed: 5,
            totalLatencyMs: 50000,
            successRate: 0.667,
            avgLatencyMs: 5000,
            lastActive: Date.now() - 20 * 3600 * 1000,
            windowStart: Date.now() - 86400000,
            expiresAt: 0,
          },
        ],
        [
          'coder-b',
          {
            agentId: 'coder-b',
            tasksCompleted: 50,
            tasksFailed: 2,
            totalLatencyMs: 100000,
            successRate: 0.962,
            avgLatencyMs: 2000,
            lastActive: Date.now(),
            windowStart: Date.now() - 86400000,
            expiresAt: 0,
          },
        ],
      ]);

      const result = AgentRouter.selectBestAgentWithReputation(candidates, reputations);
      // coder-b should win due to significantly better reputation
      expect(result).toBe('coder-b');
    });

    it('should default to 0.5 reputation score when no reputation exists', () => {
      const candidates = [
        {
          agentId: 'new-agent',
          model: 'MiniMax-M2.7',
          avgInputTokens: 1000,
          avgOutputTokens: 500,
          successRate: 0.9,
          totalInvocations: 100,
          avgDurationMs: 3000,
        },
      ];

      const result = AgentRouter.selectBestAgentWithReputation(candidates, new Map());
      expect(result).toBe('new-agent');
    });
  });
});
