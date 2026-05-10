import { AgentProcessOptions } from '../../agent/options';
import { Attachment } from '../llm';

/**
 * Interface for the Core Agent behavior.
 * Used to break circular dependencies with orchestrators and other components.
 */
export interface IAgent {
  /** Unique identifier for the agent. */
  readonly id: string;

  /**
   * Processes a user message and returns a response.
   *
   * @param userId ID of the user sending the message.
   * @param userText The message text.
   * @param options Optional processing configuration.
   * @returns A Promise resolving to the agent response.
   */
  process(
    userId: string,
    userText: string,
    options?: AgentProcessOptions
  ): Promise<{
    responseText: string;
    traceId: string;
    attachments?: Attachment[];
    thought?: string;
  }>;
}
