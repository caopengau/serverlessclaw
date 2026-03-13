import { IAgentConfig, ReasoningProfile } from '../types/index';

/**
 * Handles agent self-awareness and prompt context assembly.
 */
export class AgentContext {
  /**
   * Generates the system identity block.
   */
  static getIdentityBlock(config: IAgentConfig | undefined, model: string, provider: string, profile: ReasoningProfile, depth: number): string {
    return `
      [SYSTEM_IDENTITY]:
      - AGENT_NAME: ${config?.name || 'SuperClaw'}
      - AGENT_ID: ${config?.id || 'main'}
      - ACTIVE_PROVIDER: ${provider || 'openai (default)'}
      - ACTIVE_MODEL: ${model || 'gpt-4o-mini (default)'}
      - REASONING_PROFILE: ${profile}
      - RECURSION_DEPTH: ${depth}
    `;
  }

  /**
   * Generates the memory index block.
   */
  static getMemoryIndexBlock(distilled: string, lessonsCount: number): string {
    return `
      [MEMORY_INDEX]:
      - DISTILLED FACTS: ${distilled ? 'Available (load with recallKnowledge)' : 'None'}
      - TACTICAL LESSONS: ${lessonsCount} recent available.
      
      USE 'recallKnowledge' to retrieve details if they are relevant to the user request.
    `;
  }
}
