import { IMemory, Message, MessageRole, IProvider, ReasoningProfile } from '../types/index';
import { LIMITS } from '../constants';
import { logger } from '../logger';

/**
 * Managed context including system prompt, optional summary of older history,
 * and the active window of recent messages.
 */
export interface ManagedContext {
  messages: Message[];
  tokenEstimate: number;
}

/**
 * Handles chat session context to stay within LLM limits while maintaining efficiency.
 * Implements sliding window and automatic summarization strategies.
 */
export class ContextManager {
  /**
   * Character-to-token approximation factor (conservative).
   * 1 token is roughly 4 characters.
   */
  private static readonly CHARS_PER_TOKEN = 3; // More conservative than 4

  /**
   * Retrieves a managed context for the given user/session.
   *
   * @param history - The current message history.
   * @param summary - An optional previous summary.
   * @param systemPrompt - The current system prompt.
   * @param limit - The maximum token limit for the context.
   * @returns A promise resolving to the managed context.
   */
  static async getManagedContext(
    history: Message[],
    summary: string | null,
    systemPrompt: string,
    limit: number = LIMITS.MAX_CONTEXT_LENGTH
  ): Promise<ManagedContext> {
    const systemMessage: Message = { role: MessageRole.SYSTEM, content: systemPrompt };
    const summaryMessage: Message | null = summary
      ? {
          role: MessageRole.SYSTEM,
          content: `[PREVIOUS_HISTORY_SUMMARY]: ${summary}\n\nThe above is a summary of earlier parts of this conversation.`,
        }
      : null;

    const baseMessages = summaryMessage ? [systemMessage, summaryMessage] : [systemMessage];
    const baseTokens = this.estimateTokens(baseMessages);

    // Reserved budget for the response and safety margin (20%)
    const availableTokens = limit - baseTokens - Math.floor(limit * 0.2);

    let currentTokens = 0;
    const activeMessages: Message[] = [];

    // Add messages from newest to oldest until we hit the limit
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      const msgTokens = this.estimateTokens([msg]);
      if (currentTokens + msgTokens > availableTokens) {
        break;
      }
      activeMessages.unshift(msg);
      currentTokens += msgTokens;
    }

    return {
      messages: [...baseMessages, ...activeMessages],
      tokenEstimate: baseTokens + currentTokens,
    };
  }

  /**
   * Estimates the number of tokens in a list of messages based on character count.
   *
   * @param messages - The messages to estimate.
   * @returns The estimated token count.
   */
  static estimateTokens(messages: Message[]): number {
    let charCount = 0;
    for (const msg of messages) {
      charCount += (msg.content || '').length;
      if (msg.tool_calls) {
        charCount += JSON.stringify(msg.tool_calls).length;
      }
    }
    return Math.ceil(charCount / this.CHARS_PER_TOKEN);
  }

  /**
   * Identifies if the history needs summarization.
   *
   * @param history - The full history of the conversation.
   * @param limit - The maximum token limit.
   * @returns True if the history significantly exceeds the limit.
   */
  static needsSummarization(
    history: Message[],
    limit: number = LIMITS.MAX_CONTEXT_LENGTH
  ): boolean {
    const totalTokens = this.estimateTokens(history);
    // Trigger if total history is > 80% of the limit
    return totalTokens > limit * 0.8;
  }

  /**
   * Summarizes the conversation history.
   *
   * @param memory - The memory provider.
   * @param userId - The user identifier.
   * @param provider - The LLM provider to perform the summarization.
   * @param history - The current history of messages.
   * @returns A promise resolving when the summary is updated.
   */
  static async summarize(
    memory: IMemory,
    userId: string,
    provider: IProvider,
    history: Message[]
  ): Promise<void> {
    const previousSummary = await memory.getSummary(userId);
    const summarizationPrompt = `
      You are a memory management system for an AI agent.
      Summarize the following conversation history into a concise, high-density bulleted list of key facts, decisions, and user preferences.
      ${previousSummary ? `Incorporate this previous summary into your new summary: ${previousSummary}` : ''}
      
      CONVERSATION HISTORY:
      ${history.map((m) => `${m.role}: ${m.content}`).join('\n')}
    `;

    try {
      const response = await provider.call(
        [{ role: MessageRole.SYSTEM, content: summarizationPrompt }],
        [],
        ReasoningProfile.FAST // Use fast profile for summarization
      );

      if (response.content) {
        await memory.updateSummary(userId, response.content);
        logger.info(`Successfully updated summary for session ${userId}`);

        // Optional: After summarization, we could clear older history in DynamoDB
        // to stay "efficient" in storage as requested, but for now we keep it
        // for "recall if needed" potentially via RAG later.
      }
    } catch (e) {
      logger.error(`Failed to summarize conversation for ${userId}:`, e);
    }
  }
}
