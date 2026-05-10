import { IMemory } from './types/memory';
import { IProvider, Attachment, MessageChunk } from './types/llm';
import { ITool } from './types/tool';
import { IAgentConfig } from './types/agent';
import { IAgent } from './types/agent/behavior';
import { AgentExecutor } from './agent/executor';
import { AgentProcessOptions } from './agent/options';
import { AgentEmitter } from './agent/emitter';
import { MissionOrchestrator } from './agent/mission-orchestrator';
import { Mission, MissionOptions } from './types/mission';

export * from './agent/options';
export * from './agent/validator';
export * from './agent/executor';
export * from './agent/mission-orchestrator';

/**
 * Core Agent class responsible for orchestrating memory, LLM providers, and tool execution.
 */
export class Agent implements IAgent {
  public readonly executor: AgentExecutor;
  public readonly emitter: AgentEmitter;
  public readonly orchestrator: MissionOrchestrator;

  /**
   * Initializes the Agent with its required subsystems.
   *
   * @param memory - Memory provider for history and long-term storage.
   * @param provider - LLM provider for intelligence.
   * @param tools - Array of tools available to the agent.
   * @param config - Agent identity and behavior configuration.
   */
  constructor(
    public readonly memory: IMemory,
    public readonly provider: IProvider,
    public readonly tools: ITool[],
    public readonly config: IAgentConfig
  ) {
    this.emitter = new AgentEmitter(config);
    this.executor = new AgentExecutor(
      provider,
      tools,
      config.id,
      config.name,
      config.systemPrompt,
      null, // Initial summary is null
      undefined, // Default context limit
      config
    );
    this.orchestrator = new MissionOrchestrator(this);
  }

  /**
   * Returns the agent's unique identifier.
   */
  get id(): string {
    return this.config.id;
  }

  /**
   * Returns the full agent configuration.
   * @deprecated Use configuration property directly.
   */
  getConfig(): IAgentConfig {
    return this.config;
  }

  /**
   * Returns the full agent configuration.
   */
  get configuration(): IAgentConfig {
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
   * Processes a user message and returns a stream of response chunks.
   */
  async *stream(
    userId: string,
    userText: string,
    options: AgentProcessOptions = {}
  ): AsyncGenerator<MessageChunk> {
    const { handleStream } = await import('./agent/handlers/stream');
    yield* handleStream(this, userId, userText, options);
  }

  /**
   * Orchestrates a multi-step mission based on user intent.
   * Implements SC-3.1.
   */
  async mission(
    userId: string,
    workspaceId: string,
    intent: string,
    options: MissionOptions = {}
  ): Promise<Mission> {
    const mission = await this.orchestrator.createMission(userId, workspaceId, intent, options);
    return this.orchestrator.executeMission(mission);
  }
}
