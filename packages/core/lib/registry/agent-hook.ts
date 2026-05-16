import { logger } from '../logger';

export interface AgentHookContext {
  agentId: string;
  traceId: string;
  sessionId?: string;
  workspaceId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface IAgentHooks {
  onStart?: (context: AgentHookContext) => Promise<void> | void;
  onMessage?: (chunk: unknown, context: AgentHookContext) => Promise<void> | void;
  onToolCall?: (toolCall: unknown, context: AgentHookContext) => Promise<void> | void;
  onComplete?: (result: unknown, context: AgentHookContext) => Promise<void> | void;
  onError?: (error: unknown, context: AgentHookContext) => Promise<void> | void;
}

/**
 * Registry for agent lifecycle hooks.
 * Allows external projects to intercept and react to agent events.
 */
export class AgentHookRegistry {
  private static hooks: IAgentHooks[] = [];

  /**
   * Registers a new set of agent hooks.
   */
  static register(hooks: IAgentHooks) {
    this.hooks.push(hooks);
    logger.debug(`[AgentHookRegistry] Registered new hooks. Total: ${this.hooks.length}`);
  }

  /**
   * Triggers the onStart hook for all registered listeners.
   */
  static async triggerStart(context: AgentHookContext) {
    for (const hook of this.hooks) {
      if (hook.onStart) {
        try {
          await hook.onStart(context);
        } catch (err) {
          logger.error('[AgentHookRegistry] Error in onStart hook:', err);
        }
      }
    }
  }

  /**
   * Triggers the onMessage hook for all registered listeners.
   */
  static async triggerMessage(chunk: unknown, context: AgentHookContext) {
    for (const hook of this.hooks) {
      if (hook.onMessage) {
        try {
          await hook.onMessage(chunk, context);
        } catch (err) {
          logger.error('[AgentHookRegistry] Error in onMessage hook:', err);
        }
      }
    }
  }

  /**
   * Triggers the onToolCall hook for all registered listeners.
   */
  static async triggerToolCall(toolCall: unknown, context: AgentHookContext) {
    for (const hook of this.hooks) {
      if (hook.onToolCall) {
        try {
          await hook.onToolCall(toolCall, context);
        } catch (err) {
          logger.error('[AgentHookRegistry] Error in onToolCall hook:', err);
        }
      }
    }
  }

  /**
   * Triggers the onComplete hook for all registered listeners.
   */
  static async triggerComplete(result: unknown, context: AgentHookContext) {
    for (const hook of this.hooks) {
      if (hook.onComplete) {
        try {
          await hook.onComplete(result, context);
        } catch (err) {
          logger.error('[AgentHookRegistry] Error in onComplete hook:', err);
        }
      }
    }
  }

  /**
   * Triggers the onError hook for all registered listeners.
   */
  static async triggerError(error: unknown, context: AgentHookContext) {
    for (const hook of this.hooks) {
      if (hook.onError) {
        try {
          await hook.onError(error, context);
        } catch (err) {
          logger.error('[AgentHookRegistry] Error in onError hook:', err);
        }
      }
    }
  }

  /**
   * Clears all hooks (useful for testing).
   */
  static clear() {
    this.hooks = [];
  }
}
