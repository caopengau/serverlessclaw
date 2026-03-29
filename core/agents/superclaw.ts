import { Agent } from '../lib/agent';
import { IMemory } from '../lib/types/memory';
import { IProvider, ReasoningProfile } from '../lib/types/llm';
import { ITool } from '../lib/types/tool';
import { IAgentConfig, SafetyTier } from '../lib/types/agent';
import { SUPERCLAW_SYSTEM_PROMPT } from './prompts/index';

export { SUPERCLAW_SYSTEM_PROMPT };

/**
 * SuperClaw Agent.
 * The main orchestrator that handles user commands and delegates tasks.
 */
export class SuperClaw extends Agent {
  constructor(memory: IMemory, provider: IProvider, tools: ITool[], config?: IAgentConfig) {
    super(memory, provider, tools, config?.systemPrompt || SUPERCLAW_SYSTEM_PROMPT, config);
  }

  /**
   * Static method to parse reasoning profile from user text.
   * Handles commands like /deep, /thinking, and /fast.
   *
   * @param text - The raw user input text.
   * @returns An object containing the detected profile and the cleaned text.
   */
  static parseCommand(text: string): { profile?: ReasoningProfile; cleanText: string } {
    if (text.startsWith('/deep ')) {
      return { profile: ReasoningProfile.DEEP, cleanText: text.replace('/deep ', '') };
    }
    if (text.startsWith('/thinking ')) {
      return { profile: ReasoningProfile.THINKING, cleanText: text.replace('/thinking ', '') };
    }
    if (text.startsWith('/fast ')) {
      return { profile: ReasoningProfile.FAST, cleanText: text.replace('/fast ', '') };
    }
    return { cleanText: text };
  }

  /**
   * Checks whether an action requires HITL approval based on the agent's safety tier.
   *
   * @param agentConfig - The agent configuration.
   * @param actionType - The type of action: 'code_change' or 'deployment'.
   * @returns Whether approval is required.
   */
  static requiresApproval(
    agentConfig: IAgentConfig | undefined,
    actionType: 'code_change' | 'deployment'
  ): boolean {
    const tier = agentConfig?.safetyTier ?? SafetyTier.STAGED;

    switch (tier) {
      case SafetyTier.SANDBOX:
        // All actions require approval
        return true;
      case SafetyTier.STAGED:
        // Only deployment requires approval
        return actionType === 'deployment';
      case SafetyTier.AUTONOMOUS:
        // No approval needed
        return false;
      default:
        return true; // Fail safe
    }
  }
}
