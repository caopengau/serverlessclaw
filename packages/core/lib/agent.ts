import { IMemory } from './types/memory';
import { IProvider, MessageChunk } from './types/llm';
import { ITool } from './types/tool';
import { IAgentConfig } from './types/agent';
import { AgentProcessOptions } from './agent/options';

export * from './agent/options';
export * from './agent/validator';

/**
 * Core Agent class responsible for orchestrating memory, LLM providers, and tool execution.
 * Lazily loads heavy subsystems to reduce static context budget.
 */
export class Agent {
  /**
   * Initializes the Agent with its required subsystems.
   */
  constructor(
    public readonly memory: IMemory,
    public readonly provider: IProvider,
    public readonly tools: ITool[],
    public readonly config: IAgentConfig
  ) {}

  /**
   * Returns the agent's unique identifier.
   */
  get id(): string {
    return this.config.id;
  }

  /**
   * Main processing entry point. Orchestrates the agent loop.
   */
  async process(
    userId: string,
    userText: string,
    options: AgentProcessOptions = {}
  ): Promise<string> {
    const { handleProcess } = await import('./agent/handlers/process');
    return handleProcess(this, userId, userText, options);
  }

  /**
   * Streaming version of the processing entry point.
   */
  async *processStream(
    userId: string,
    userText: string,
    options: AgentProcessOptions = {}
  ): AsyncGenerator<MessageChunk> {
    const { handleStream } = await import('./agent/handlers/stream');
    yield* handleStream(this, userId, userText, options);
  }
}
