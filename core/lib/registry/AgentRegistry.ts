/**
 * The AgentRegistry is a central directory for all available agent types.
 * It allows for modular discovery and loading of agents based on spoke needs.
 */

export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  description: string;
  isCore: boolean; // CORE agents are always available in the Hub template.
}

export class AgentRegistry {
  private agents: Map<string, AgentDefinition> = new Map();

  constructor() {
    this.registerCoreAgents();
  }

  private registerCoreAgents() {
    this.registerAgent({
      id: 'super-claw',
      name: 'SuperClaw',
      role: 'Orchestrator',
      description: 'The central backbone for agentic coordination.',
      isCore: true,
    });
    this.registerAgent({
      id: 'coder-agent',
      name: 'CoderAgent',
      role: 'Code Synthesis',
      description: 'The specialist for code generation and refactoring.',
      isCore: true,
    });
    this.registerAgent({
      id: 'qa-auditor',
      name: 'QA Auditor',
      role: 'Quality Assurance',
      description: 'The specialist for testing and deployment verification.',
      isCore: true,
    });
  }

  public registerAgent(agent: AgentDefinition) {
    this.agents.set(agent.id, agent);
    console.log(`[AgentRegistry] Registered agent: ${agent.id}`);
  }

  public getAgent(id: string): AgentDefinition | undefined {
    return this.agents.get(id);
  }

  public listAgents(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }
}

export const globalAgentRegistry = new AgentRegistry();
