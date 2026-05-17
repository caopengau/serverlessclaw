import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  proposeAutonomyUpdate,
  getSwarmTelemetry,
  proposeTopologyChange,
  proposePromptOptimization,
  suggestTrustScaleShift,
} from './governance';
import { CoManagementManager } from '../co-management-manager';
import { TokenTracker } from '../../metrics/token-usage';
import { emitTypedEvent } from '../../utils/typed-emit';

vi.mock('../../registry/config', () => ({
  ConfigManager: {
    getRawConfig: vi.fn().mockResolvedValue({}),
    saveRawConfig: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../co-management-manager', () => ({
  CoManagementManager: {
    saveProposal: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../metrics/token-usage', () => ({
  TokenTracker: {
    getToolRollupRange: vi.fn().mockResolvedValue([{ invocationCount: 5 }]),
    getRollupRange: vi.fn().mockResolvedValue([{ totalInputTokens: 100 }]),
    getInvocationHistory: vi.fn().mockResolvedValue([{ traceId: 't-1' }]),
  },
}));

vi.mock('../../utils/typed-emit', () => ({
  emitTypedEvent: vi.fn().mockResolvedValue(undefined),
}));

describe('Agent Governance Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('proposeAutonomyUpdate', () => {
    it('should submit a legacy autonomy proposal and emit an event', async () => {
      const res = await proposeAutonomyUpdate({
        agentId: 'coder',
        targetMode: 'AUTO',
        reason: 'Performance benchmarks passing',
        trustScore: 89,
      });

      expect(res).toContain('SUCCESS: Proposal prop_');
      expect(emitTypedEvent).toHaveBeenCalledWith(
        'governance.propose',
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('getSwarmTelemetry', () => {
    it('should fetch tool telemetry when toolName is provided', async () => {
      const res: any = await getSwarmTelemetry({
        workspaceId: 'workspace-a',
        toolName: 'read_file',
        timeRangeDays: 5,
      });

      expect(res.type).toBe('tool_telemetry');
      expect(res.toolName).toBe('read_file');
      expect(TokenTracker.getToolRollupRange).toHaveBeenCalledWith('read_file', 5, {
        workspaceId: 'workspace-a',
      });
    });

    it('should fetch agent telemetry when toolName is absent', async () => {
      const res: any = await getSwarmTelemetry({
        workspaceId: 'workspace-a',
        agentId: 'coder-pro',
        timeRangeDays: 10,
      });

      expect(res.type).toBe('agent_telemetry');
      expect(res.agentId).toBe('coder-pro');
      expect(TokenTracker.getRollupRange).toHaveBeenCalledWith('coder-pro', 10, {
        workspaceId: 'workspace-a',
      });
      expect(TokenTracker.getInvocationHistory).toHaveBeenCalledWith('coder-pro', 10, {
        workspaceId: 'workspace-a',
      });
    });
  });

  describe('proposeTopologyChange', () => {
    it('should stage a topology proposal and trigger an event', async () => {
      const proposedNodes = {
        orch: {
          agentId: 'orch-bot',
          role: 'router',
          systemPromptFragmentKeys: [],
          tools: [],
          nextNodes: [],
          routingStrategy: 'AUTO' as const,
        },
      };

      const res = await proposeTopologyChange({
        workspaceId: 'workspace-a',
        proposalId: 'prop-topo-1',
        topologyName: 'main-loop',
        proposedNodes,
        entryNode: 'orch',
        proposedBy: 'agent-planner',
        justification: 'Fixing bottleneck',
      });

      expect(res).toContain('SUCCESS: Swarm Topology proposal prop-topo-1');
      expect(CoManagementManager.saveProposal).toHaveBeenCalled();
      expect(emitTypedEvent).toHaveBeenCalledWith(
        'governance.proposal.submit',
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('proposePromptOptimization', () => {
    it('should stage a prompt proposal and emit an event', async () => {
      const res = await proposePromptOptimization({
        workspaceId: 'workspace-a',
        proposalId: 'prop-prompt-1',
        fragmentKey: 'sys-critic',
        proposedContent: 'Be extremely pedantic.',
        proposedBy: 'agent-critic',
        justification: 'Need sharper critiques',
      });

      expect(res).toContain('SUCCESS: Prompt Fragment proposal prop-prompt-1');
      expect(CoManagementManager.saveProposal).toHaveBeenCalled();
      expect(emitTypedEvent).toHaveBeenCalledWith(
        'governance.proposal.submit',
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('suggestTrustScaleShift', () => {
    it('should stage a trust parameters proposal and emit an event', async () => {
      const res = await suggestTrustScaleShift({
        workspaceId: 'workspace-a',
        proposalId: 'prop-trust-1',
        proposedBy: 'agent-security',
        justification: 'Higher failure rates logged',
        anomalyTolerance: 'STRICT',
        costCapPerRunUSD: 3.5,
      });

      expect(res).toContain('SUCCESS: Trust Config proposal prop-trust-1');
      expect(CoManagementManager.saveProposal).toHaveBeenCalled();
      expect(emitTypedEvent).toHaveBeenCalledWith(
        'governance.proposal.submit',
        expect.any(String),
        expect.any(Object)
      );
    });
  });
});
