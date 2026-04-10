import { Message, ITool, IProvider, MessageChunk, IAgentConfig } from '../types/index';
import { LIMITS } from '../constants';
import { AGENT_DEFAULTS, AGENT_LOG_MESSAGES, LoopResult, ExecutorOptions } from './executor-types';
export { AGENT_DEFAULTS, AGENT_LOG_MESSAGES };
import { ExecutorCore } from './executor-core';

/**
 * Handles the iterative execution loop of an agent.
 * Facade for ExecutorCore.
 */
export class AgentExecutor {
  private core: ExecutorCore;

  constructor(
    provider: IProvider,
    tools: ITool[],
    agentId: string,
    agentName: string,
    systemPrompt: string = '',
    summary: string | null = null,
    contextLimit: number = LIMITS.MAX_CONTEXT_LENGTH,
    agentConfig?: IAgentConfig
  ) {
    this.core = new ExecutorCore(
      provider,
      tools,
      agentId,
      agentName,
      systemPrompt,
      summary,
      contextLimit,
      agentConfig
    );
  }

  /**
   * Run the standard execution loop.
   */
  async runLoop(messages: Message[], options: ExecutorOptions): Promise<LoopResult> {
    return this.core.runLoop(messages, options);
  }

  /**
   * Run the streaming execution loop.
   */
  async *streamLoop(messages: Message[], options: ExecutorOptions): AsyncIterable<MessageChunk> {
    yield* this.core.streamLoop(messages, options);
  }
}
