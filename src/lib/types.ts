export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

/**
 * Memory Adapter interface for persistent state.
 */
export interface IMemory {
  getHistory(userId: string): Promise<Message[]>;
  addMessage(userId: string, message: Message): Promise<void>;
  clearHistory(userId: string): Promise<void>;
  getDistilledMemory(userId: string): Promise<string>;
  updateDistilledMemory(userId: string, facts: string): Promise<void>;
}

/**
 * Tool interface for agent capabilities.
 */
export interface ITool {
  name: string;
  description: string;
  parameters: unknown;
  execute(args: Record<string, unknown>): Promise<string>;
}

/**
 * Channel Adapter for different messaging platforms (Telegram, Discord, etc.)
 */
export interface IChannel {
  send(userId: string, text: string): Promise<void>;
}

/**
 * Reasoning profiles for LLM providers.
 * fast: Low reasoning, high speed (e.g., gpt-5-mini, flash models)
 * standard: Balanced reasoning (e.g., gpt-5.4 default)
 * thinking: High reasoning for complex logic (e.g., gpt-5.4 high)
 * deep: Maximum reasoning for architecture or recovery (e.g., gpt-5.4 xhigh)
 */
export type ReasoningProfile = 'fast' | 'standard' | 'thinking' | 'deep';

/**
 * Provider interface for LLM backends.
 */
export interface IProvider {
  call(messages: Message[], tools?: ITool[], profile?: ReasoningProfile): Promise<Message>;
}

/**
 * Lock Manager for session isolation.
 */
export interface ILockManager {
  acquire(lockId: string, ttlSeconds: number): Promise<boolean>;
  release(lockId: string): Promise<void>;
}
