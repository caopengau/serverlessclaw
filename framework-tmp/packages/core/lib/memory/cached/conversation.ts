import { IMemory, Message, ConversationMeta, ContextualScope } from '../../types/memory/interfaces';
import { logger } from '../../logger';
import { MemoryCaches, CacheKeys } from '../cache';
import { CACHE_TTL } from '../../constants/memory';

/**
 * Handles conversation-related memory operations (history, summary, meta)
 * for the CachedMemory provider.
 */
export class MemoryConversation {
  private historyPromises: Map<string, Promise<Message[]>> = new Map();

  constructor(private readonly underlying: IMemory) {}

  async getHistory(userId: string, scope?: string | ContextualScope): Promise<Message[]> {
    const cacheKey = CacheKeys.history(userId, scope);
    const cached = MemoryCaches.conversation.get(cacheKey) as Message[] | undefined;

    if (cached) {
      logger.debug(`Cache hit for history: ${userId}`);
      return cached;
    }

    const existingPromise = this.historyPromises.get(cacheKey);
    if (existingPromise) {
      logger.debug(`Coalescing concurrent history request for: ${userId}`);
      return existingPromise;
    }

    logger.debug(`Cache miss for history: ${userId}`);
    const promise = this.underlying.getHistory(userId, scope).finally(() => {
      this.historyPromises.delete(cacheKey);
    });

    this.historyPromises.set(cacheKey, promise);
    const history = await promise;
    MemoryCaches.conversation.set(cacheKey, history, CACHE_TTL.CONVERSATION);
    return history;
  }

  async addMessage(
    userId: string,
    message: Message,
    scope?: string | ContextualScope
  ): Promise<void> {
    await this.underlying.addMessage(userId, message, scope);
    MemoryCaches.conversation.delete(CacheKeys.history(userId, scope));
    MemoryCaches.conversation.delete(CacheKeys.summary(userId, scope));
  }

  async getSummary(userId: string, scope?: string | ContextualScope): Promise<string | null> {
    const cacheKey = CacheKeys.summary(userId, scope);
    const cached = MemoryCaches.conversation.get(cacheKey) as string | null | undefined;

    if (cached !== undefined) {
      logger.debug(`Cache hit for summary: ${userId}`);
      return cached;
    }

    const summary = await this.underlying.getSummary(userId, scope);
    MemoryCaches.conversation.set(cacheKey, summary, CACHE_TTL.CONVERSATION);
    return summary;
  }

  async updateSummary(
    userId: string,
    summary: string,
    scope?: string | ContextualScope
  ): Promise<void> {
    await this.underlying.updateSummary(userId, summary, scope);
    MemoryCaches.conversation.delete(CacheKeys.summary(userId, scope));
  }

  async listConversations(
    userId: string,
    scope?: string | ContextualScope
  ): Promise<ConversationMeta[]> {
    return this.underlying.listConversations(userId, scope);
  }

  async deleteConversation(
    userId: string,
    sessionId: string,
    scope?: string | ContextualScope
  ): Promise<void> {
    await this.underlying.deleteConversation(userId, sessionId, scope);
    MemoryCaches.conversation.delete(CacheKeys.history(userId, scope));
  }

  async saveConversationMeta(
    userId: string,
    sessionId: string,
    meta: Partial<ConversationMeta>,
    scope?: string | ContextualScope
  ): Promise<void> {
    await this.underlying.saveConversationMeta(userId, sessionId, meta, scope);
    MemoryCaches.conversation.delete(CacheKeys.history(userId, scope));
    MemoryCaches.conversation.delete(CacheKeys.summary(userId, scope));
  }

  async getSessionMetadata(
    sessionId: string,
    scope?: string | ContextualScope
  ): Promise<ConversationMeta | null> {
    return this.underlying.getSessionMetadata(sessionId, scope);
  }

  async clearHistory(userId: string, scope?: string | ContextualScope): Promise<void> {
    await this.underlying.clearHistory(userId, scope);
    MemoryCaches.conversation.delete(CacheKeys.history(userId, scope));
    MemoryCaches.conversation.delete(CacheKeys.summary(userId, scope));
  }
}
