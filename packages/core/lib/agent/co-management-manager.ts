import { ConfigManager } from '../registry/config';
import { SwarmTopology, PromptFragment, TrustConfig, SwarmProposal } from './co-management';

export class CoManagementManager {
  // ==========================================
  // Swarm Topology CRUD
  // ==========================================

  public static async getTopology(
    workspaceId: string,
    topologyName: string
  ): Promise<SwarmTopology | null> {
    const key = `swarm_topology_${topologyName}`;
    return ConfigManager.getTypedConfig<SwarmTopology | null>(key, null, {
      workspaceId,
    });
  }

  public static async saveTopology(
    topology: SwarmTopology,
    authorId: string = 'system'
  ): Promise<void> {
    const key = `swarm_topology_${topology.topologyName}`;
    await ConfigManager.saveRawConfig(key, topology, {
      workspaceId: topology.workspaceId,
      skipVersioning: false,
      author: authorId,
      description: `Update Swarm Topology: ${topology.topologyName}`,
    });
  }

  public static async deleteTopology(workspaceId: string, topologyName: string): Promise<void> {
    const key = `swarm_topology_${topologyName}`;
    await ConfigManager.deleteConfig(key, { workspaceId });
  }

  // ==========================================
  // Prompt Fragment CRUD
  // ==========================================

  public static async getPromptFragment(
    workspaceId: string,
    fragmentKey: string
  ): Promise<PromptFragment | null> {
    const key = `prompt_fragment_${fragmentKey}`;
    return ConfigManager.getTypedConfig<PromptFragment | null>(key, null, {
      workspaceId,
    });
  }

  public static async savePromptFragment(
    fragment: PromptFragment,
    authorId: string = 'system'
  ): Promise<void> {
    const key = `prompt_fragment_${fragment.fragmentKey}`;
    await ConfigManager.saveRawConfig(key, fragment, {
      workspaceId: fragment.workspaceId,
      skipVersioning: false,
      author: authorId,
      description: `Update Prompt Fragment: ${fragment.fragmentKey}`,
    });
  }

  public static async deletePromptFragment(
    workspaceId: string,
    fragmentKey: string
  ): Promise<void> {
    const key = `prompt_fragment_${fragmentKey}`;
    await ConfigManager.deleteConfig(key, { workspaceId });
  }

  // ==========================================
  // Trust Config CRUD
  // ==========================================

  public static async getTrustConfig(workspaceId: string): Promise<TrustConfig | null> {
    const key = 'workspace_trust_config';
    return ConfigManager.getTypedConfig<TrustConfig | null>(key, null, {
      workspaceId,
    });
  }

  public static async saveTrustConfig(
    config: TrustConfig,
    authorId: string = 'system'
  ): Promise<void> {
    const key = 'workspace_trust_config';
    await ConfigManager.saveRawConfig(key, config, {
      workspaceId: config.workspaceId,
      skipVersioning: false,
      author: authorId,
      description: 'Update Workspace Trust and Safety Config',
    });
  }

  public static async deleteTrustConfig(workspaceId: string): Promise<void> {
    const key = 'workspace_trust_config';
    await ConfigManager.deleteConfig(key, { workspaceId });
  }

  // ==========================================
  // Swarm Proposal CRUD
  // ==========================================

  public static async getProposal(
    workspaceId: string,
    proposalId: string
  ): Promise<SwarmProposal | null> {
    const key = `swarm_proposal_${proposalId}`;
    return ConfigManager.getTypedConfig<SwarmProposal | null>(key, null, {
      workspaceId,
    });
  }

  public static async saveProposal(proposal: SwarmProposal): Promise<void> {
    const key = `swarm_proposal_${proposal.proposalId}`;
    await ConfigManager.saveRawConfig(key, proposal, {
      workspaceId: proposal.workspaceId,
      skipVersioning: false,
      author: proposal.proposedBy,
      description: `Submit Governance Proposal: ${proposal.proposalId} (${proposal.proposalType})`,
    });
  }

  public static async deleteProposal(workspaceId: string, proposalId: string): Promise<void> {
    const key = `swarm_proposal_${proposalId}`;
    await ConfigManager.deleteConfig(key, { workspaceId });
  }
}
