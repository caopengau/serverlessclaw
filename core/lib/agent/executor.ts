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

  /**
   * Initializes the AgentExecutor with specialized sub-executors for standard and streaming flows.
   *
   * @param provider - LLM provider instance for generating completions.
   * @param tools - Array of available tools for the agent.
   * @param agentId - Unique identifier of the agent.
   * @param agentName - Human-readable name of the agent.
   * @param systemPrompt - Initial system instructions for the LLM.
   * @param summary - Optional summary of past interactions for context compression.
   * @param contextLimit - Maximum number of tokens allowed in the context window.
   * @param agentConfig - Optional full agent configuration object.
   */
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
   * Run the standard execution loop until a final response is generated or max iterations reached.
   *
   * @param messages - Current conversation history.
   * @param options - Execution control options (budgets, tracers, etc).
   * @returns A promise resolving to the final response and usage metrics.
   */
  async runLoop(messages: Message[], options: ExecutorOptions): Promise<LoopResult> {
    return this.standardExecutor.runLoop(messages, options);
  }

  /**
   * Run the streaming execution loop, yielding partial response chunks as they arrive.
   *
   * @param messages - Current conversation history.
   * @param options - Execution control options (budgets, tracers, etc).
   * @yields Incremental message chunks and tool call metadata.
   */
  async *streamLoop(messages: Message[], options: ExecutorOptions): AsyncIterable<MessageChunk> {
    yield* this.streamingExecutor.streamLoop(messages, options);
  }
}
