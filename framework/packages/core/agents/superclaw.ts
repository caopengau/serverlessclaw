import { Agent } from '../lib/agent';
import { IMemory } from '../lib/types/memory';
import { IProvider, ReasoningProfile } from '../lib/types/llm';
import { ITool } from '../lib/types/tool';
import { IAgentConfig, SafetyTier, SafetyPolicy } from '../lib/types/agent';

/**
 * SuperClaw Agent.
 * The main orchestrator that handles user commands and delegates tasks.
 */
export class SuperClaw extends Agent {
  /**
   * SafetyEngine instance for granular safety evaluation.
   * Lazily loaded to reduce static context budget.
   */
  private _safetyEngine: any;

  constructor(memory: IMemory, provider: IProvider, tools: ITool[], config?: IAgentConfig) {
    super(memory, provider, tools, config!);
  }

  private async getSafetyEngine() {
    if (!this._safetyEngine) {
      const { SafetyEngine } = await import('../lib/safety/safety-engine');
      this._safetyEngine = new SafetyEngine();
    }
    return this._safetyEngine;
  }

  /**
   * Static method to parse reasoning profile from user text.
   * Handles commands like /deep, /thinking, and /fast.
   * Also handles approval responses like APPROVE and REJECT.
   *
   * @param text - The raw user input text.
   * @returns An object containing the detected profile and the cleaned text.
   */
  static parseCommand(text: string): {
    profile?: ReasoningProfile;
    cleanText: string;
    command?: string;
  } {
    if (text.startsWith('/deep ')) {
      return { profile: ReasoningProfile.DEEP, cleanText: text.replace('/deep ', '') };
    }
    if (text.startsWith('/thinking ')) {
      return { profile: ReasoningProfile.THINKING, cleanText: text.replace('/thinking ', '') };
    }
    if (text.startsWith('/fast ')) {
      return { profile: ReasoningProfile.FAST, cleanText: text.replace('/fast ', '') };
    }
    const upperText = text.trim().toUpperCase();
    if (upperText === 'APPROVE' || upperText === 'REJECT') {
      return { cleanText: '', command: upperText };
    }
    return { cleanText: text };
  }

  /**
   * Checks whether an action requires HITL approval based on granular safety policies.
   *
   * @param agentConfig - The agent configuration.
   * @param actionType - The type of action: 'code_change', 'deployment', 'file_operation', 'shell_command', or 'mcp_tool'.
   * @param context - Optional context including tool name, resource path, etc.
   * @returns Whether approval is required.
   */
  async requiresApproval(
    agentConfig: IAgentConfig | undefined,
    actionType: 'code_change' | 'deployment' | 'file_operation' | 'shell_command' | 'mcp_tool',
    context?: {
      toolName?: string;
      resource?: string;
      traceId?: string;
      userId?: string;
      workspaceId?: string;
    }
  ): Promise<boolean> {
    const engine = await this.getSafetyEngine();
    const result = await engine.evaluateAction(agentConfig, actionType, context);
    return result.requiresApproval;
  }

  /**
   * Evaluates an action against granular safety policies and returns detailed result.
   *
   * @param agentConfig - The agent configuration.
   * @param actionType - The type of action.
   * @param context - Optional context including tool name, resource path, etc.
   * @returns Detailed safety evaluation result.
   */
  async evaluateAction(
    agentConfig: IAgentConfig | undefined,
    actionType: string,
    context?: {
      toolName?: string;
      resource?: string;
      traceId?: string;
      userId?: string;
      workspaceId?: string;
    }
  ) {
    const engine = await this.getSafetyEngine();
    return engine.evaluateAction(agentConfig, actionType, context);
  }

  /**
   * Configure a custom safety policy for a specific tier.
   *
   * @param tier - The safety tier to configure.
   * @param policy - Partial policy updates.
   */
  async configureSafetyPolicy(tier: SafetyTier, policy: Partial<SafetyPolicy>): Promise<void> {
    const engine = await this.getSafetyEngine();
    engine.updatePolicy(tier, policy);
  }

  /**
   * Set a tool-specific safety override.
   *
   * @param override - The tool safety override configuration.
   */
  async setToolSafetyOverride(override: any): Promise<void> {
    const engine = await this.getSafetyEngine();
    engine.setToolOverride(override);
  }
}
