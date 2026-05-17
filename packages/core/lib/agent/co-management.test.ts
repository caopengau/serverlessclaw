import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoManagementManager } from './co-management-manager';
import {
  SwarmTopology,
  PromptFragment,
  TrustConfig,
  SwarmProposal,
  ProposalType,
  ProposalStatus,
} from './co-management';

vi.mock('../registry/config', () => ({
  ConfigManager: {
    getTypedConfig: vi.fn().mockResolvedValue(null),
    saveRawConfig: vi.fn().mockResolvedValue(undefined),
    deleteConfig: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('CoManagementManager', () => {
  let mockConfigManager: any;

  beforeEach(async () => {
    const configModule = await import('../registry/config');
    mockConfigManager = vi.mocked(configModule.ConfigManager);
    vi.clearAllMocks();
  });

  describe('Swarm Topologies CRUD', () => {
    const mockTopology: SwarmTopology = {
      workspaceId: 'workspace-a',
      topologyName: 'dev-workflow',
      entryNode: 'orch',
      nodes: {
        orch: {
          agentId: 'orchestrator-core',
          role: 'Router',
          systemPromptFragmentKeys: ['sys-base'],
          tools: ['read_file'],
          nextNodes: ['coder'],
          routingStrategy: 'AUTO',
        },
        coder: {
          agentId: 'coder-pro',
          role: 'Builder',
          systemPromptFragmentKeys: ['sys-base', 'sys-ts-rules'],
          tools: ['read_file', 'write_file'],
          nextNodes: [],
          routingStrategy: 'AUTO',
        },
      },
      updatedAt: 123456789,
      version: 1,
    };

    it('should retrieve a topology', async () => {
      mockConfigManager.getTypedConfig.mockResolvedValueOnce(mockTopology);

      const result = await CoManagementManager.getTopology('workspace-a', 'dev-workflow');
      expect(result).toEqual(mockTopology);
      expect(mockConfigManager.getTypedConfig).toHaveBeenCalledWith(
        'swarm_topology_dev-workflow',
        null,
        {
          workspaceId: 'workspace-a',
        }
      );
    });

    it('should save a topology', async () => {
      await CoManagementManager.saveTopology(mockTopology, 'agent-manager');

      expect(mockConfigManager.saveRawConfig).toHaveBeenCalledWith(
        'swarm_topology_dev-workflow',
        mockTopology,
        {
          workspaceId: 'workspace-a',
          skipVersioning: false,
          author: 'agent-manager',
          description: 'Update Swarm Topology: dev-workflow',
        }
      );
    });

    it('should delete a topology', async () => {
      await CoManagementManager.deleteTopology('workspace-a', 'dev-workflow');

      expect(mockConfigManager.deleteConfig).toHaveBeenCalledWith('swarm_topology_dev-workflow', {
        workspaceId: 'workspace-a',
      });
    });
  });

  describe('Prompt Fragments CRUD', () => {
    const mockFragment: PromptFragment = {
      workspaceId: 'workspace-a',
      fragmentKey: 'sys-ts-rules',
      description: 'Strict TypeScript guidelines',
      content: 'Always declare parameter interfaces and keep signatures pure.',
      updatedAt: 123456789,
      version: 2,
      authorId: 'agent-auditor',
    };

    it('should retrieve a prompt fragment', async () => {
      mockConfigManager.getTypedConfig.mockResolvedValueOnce(mockFragment);

      const result = await CoManagementManager.getPromptFragment('workspace-a', 'sys-ts-rules');
      expect(result).toEqual(mockFragment);
      expect(mockConfigManager.getTypedConfig).toHaveBeenCalledWith(
        'prompt_fragment_sys-ts-rules',
        null,
        {
          workspaceId: 'workspace-a',
        }
      );
    });

    it('should save a prompt fragment', async () => {
      await CoManagementManager.savePromptFragment(mockFragment, 'agent-auditor');

      expect(mockConfigManager.saveRawConfig).toHaveBeenCalledWith(
        'prompt_fragment_sys-ts-rules',
        mockFragment,
        {
          workspaceId: 'workspace-a',
          skipVersioning: false,
          author: 'agent-auditor',
          description: 'Update Prompt Fragment: sys-ts-rules',
        }
      );
    });

    it('should delete a prompt fragment', async () => {
      await CoManagementManager.deletePromptFragment('workspace-a', 'sys-ts-rules');

      expect(mockConfigManager.deleteConfig).toHaveBeenCalledWith('prompt_fragment_sys-ts-rules', {
        workspaceId: 'workspace-a',
      });
    });
  });

  describe('Trust Config CRUD', () => {
    const mockTrust: TrustConfig = {
      workspaceId: 'workspace-a',
      anomalyTolerance: 'STRICT',
      costCapPerRunUSD: 5.0,
      consecutiveFailureThreshold: 3,
      agentReputationalScores: {
        'coder-pro': 95,
        'deployer-bot': 88,
      },
      updatedAt: 123456789,
    };

    it('should retrieve trust config', async () => {
      mockConfigManager.getTypedConfig.mockResolvedValueOnce(mockTrust);

      const result = await CoManagementManager.getTrustConfig('workspace-a');
      expect(result).toEqual(mockTrust);
      expect(mockConfigManager.getTypedConfig).toHaveBeenCalledWith(
        'workspace_trust_config',
        null,
        {
          workspaceId: 'workspace-a',
        }
      );
    });

    it('should save trust config', async () => {
      await CoManagementManager.saveTrustConfig(mockTrust, 'user-admin');

      expect(mockConfigManager.saveRawConfig).toHaveBeenCalledWith(
        'workspace_trust_config',
        mockTrust,
        {
          workspaceId: 'workspace-a',
          skipVersioning: false,
          author: 'user-admin',
          description: 'Update Workspace Trust and Safety Config',
        }
      );
    });

    it('should delete trust config', async () => {
      await CoManagementManager.deleteTrustConfig('workspace-a');

      expect(mockConfigManager.deleteConfig).toHaveBeenCalledWith('workspace_trust_config', {
        workspaceId: 'workspace-a',
      });
    });
  });

  describe('Swarm Proposals CRUD', () => {
    const mockProposal: SwarmProposal = {
      workspaceId: 'workspace-a',
      proposalId: 'prop-101',
      proposalType: ProposalType.PROMPT,
      status: ProposalStatus.PENDING_HUMAN_APPROVAL,
      proposedBy: 'agent-manager',
      justification: 'TypeScript compilation failure rate exceeded 12% in traces.',
      promptProposal: {
        fragmentKey: 'sys-ts-rules',
        content: 'Inject rigorous interface rules.',
      },
      createdAt: 123456789,
      updatedAt: 123456789,
    };

    it('should retrieve a proposal', async () => {
      mockConfigManager.getTypedConfig.mockResolvedValueOnce(mockProposal);

      const result = await CoManagementManager.getProposal('workspace-a', 'prop-101');
      expect(result).toEqual(mockProposal);
      expect(mockConfigManager.getTypedConfig).toHaveBeenCalledWith(
        'swarm_proposal_prop-101',
        null,
        {
          workspaceId: 'workspace-a',
        }
      );
    });

    it('should save a proposal', async () => {
      await CoManagementManager.saveProposal(mockProposal);

      expect(mockConfigManager.saveRawConfig).toHaveBeenCalledWith(
        'swarm_proposal_prop-101',
        mockProposal,
        {
          workspaceId: 'workspace-a',
          skipVersioning: false,
          author: 'agent-manager',
          description: 'Submit Governance Proposal: prop-101 (PROMPT)',
        }
      );
    });

    it('should delete a proposal', async () => {
      await CoManagementManager.deleteProposal('workspace-a', 'prop-101');

      expect(mockConfigManager.deleteConfig).toHaveBeenCalledWith('swarm_proposal_prop-101', {
        workspaceId: 'workspace-a',
      });
    });
  });
});
