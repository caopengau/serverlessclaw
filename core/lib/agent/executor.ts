import { Message, ITool, IProvider, MessageChunk, IAgentConfig } from '../types/index';
import { LIMITS } from '../constants';
import { AGENT_DEFAULTS, AGENT_LOG_MESSAGES, LoopResult, ExecutorOptions } from './executor-types';
export { AGENT_DEFAULTS, AGENT_LOG_MESSAGES };
import { StandardExecutor } from './executor/standard-executor';
import { StreamingExecutor } from './executor/streaming-executor';

/**
 * Handles the iterative execution loop of an agent.
 */
export class AgentExecutor {
  private standardExecutor: StandardExecutor;
  private streamingExecutor: StreamingExecutor;

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
    this.standardExecutor = new StandardExecutor(
      provider,
      tools,
      agentId,
      agentName,
      systemPrompt,
      summary,
      contextLimit,
      agentConfig
    );
    this.streamingExecutor = new StreamingExecutor(
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
    return this.standardExecutor.runLoop(messages, options);
  }

  /**
   * Run the streaming execution loop.
   */
  async *streamLoop(messages: Message[], options: ExecutorOptions): AsyncIterable<MessageChunk> {
    yield* this.streamingExecutor.streamLoop(messages, options);
  }
}
