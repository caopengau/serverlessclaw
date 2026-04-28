import { IMemory, IProvider, ITool, IAgentConfig, Attachment, MessageChunk } from './types/index';
import { AgentProcessOptions } from './agent/options';
import { AgentEmitter } from './agent/emitter';
import { validateAgentConfig } from './agent/validator';
import { AGENT_SYSTEM_IDS, COMMUNICATION_MODES } from './constants/agent';

const DEFAULT_CONFIG: Partial<IAgentConfig> = {
  id: AGENT_SYSTEM_IDS.UNKNOWN,
  name: AGENT_SYSTEM_IDS.SUPERCLAW,
  maxIterations: 10,
  defaultCommunicationMode: COMMUNICATION_MODES.TEXT,
};

// Re-export validation for backward compatibility and tests
export { validateAgentConfig };

/**
 * Main Agent Class
 * Refactored to delegate complex processing to specialized handlers.
 */
export class Agent {
  public memory: IMemory;
  public provider: IProvider;
  public tools: ITool[];
  public config?: IAgentConfig;
  public emitter: AgentEmitter;

  constructor(memory: IMemory, provider: IProvider, tools: ITool[], config?: IAgentConfig) {
    this.memory = memory;
    this.provider = provider;
    this.tools = tools;
    this.config = config ?? (DEFAULT_CONFIG as IAgentConfig);
    this.emitter = new AgentEmitter(this.config);
  }

  /**
   * Returns the agent's configuration.
   */
  public getConfig(): IAgentConfig | undefined {
    return this.config;
  }

  /**
   * Processes a user message and returns the final response.
   */
  async process(
    userId: string,
    userText: string,
    options: AgentProcessOptions = {}
  ): Promise<{
    responseText: string;
    traceId: string;
    attachments?: Attachment[];
    thought?: string;
  }> {
    const { handleProcess } = await import('./agent/handlers/process');
    return handleProcess(this, userId, userText, options);
  }

  /**
   * Streaming version of process().
   */
  async *stream(
    userId: string,
    userText: string,
    options: AgentProcessOptions = {}
  ): AsyncGenerator<MessageChunk> {
    const { handleStream } = await import('./agent/handlers/stream');
    yield* handleStream(this, userId, userText, options);
  }
}
