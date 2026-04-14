/**
 * @module CachedMemory
 * @description Wrapper for DynamoMemory that adds LRU caching for frequently accessed items.
 * Reduces DynamoDB read operations while maintaining data consistency through proper cache invalidation.
 */

import {
  IMemory,
  Message,
  InsightMetadata,
  MemoryInsight,
  InsightCategory,
  GapStatus,
  GapTransitionResult,
  ConversationMeta,
} from '../types/index';
import type { Collaboration, CollaborationRole, ParticipantType } from '../types/collaboration';
import { DynamoMemory } from '../memory';
import { MemoryCaches, CacheKeys, getCacheStatsSummary } from './cache';
import { logger } from '../logger';

/**
 * Cached memory provider that wraps DynamoMemory with LRU caching.
 * Implements cache-aside pattern with proper invalidation on writes.
 *
 * ## TTL Strategy
 *
 * Cache TTLs are tuned based on data volatility and access patterns:
 *
 * | Cache Type       | TTL   | Rationale                                                    |
 * |------------------|-------|--------------------------------------------------------------|
 * | Conversation     | 2 min | High volatility - messages added frequently                |
 * | User Data        | 5 min | Medium volatility - user preferences, distilled memory     |
 * | System-wide      | 15 min| Low volatility - global lessons, system-wide data          |
 * | Search Results   | 3 min | Medium volatility - query results may change               |
 *
 * The 5-minute default in MemoryCache provides a baseline for user-scoped data.
 */
export class CachedMemory implements IMemory {
  private historyPromises: Map<string, Promise<Message[]>> = new Map();

  constructor(private readonly underlying: DynamoMemory) {}

  /**
   * Gets conversation history with caching.
   * Cache is invalidated when new messages are added.
   */
  async getHistory(userId: string, workspaceId?: string): Promise<Message[]> {
    const cacheKey = CacheKeys.history(userId, workspaceId);
    const cached = MemoryCaches.conversation.get(cacheKey) as Message[] | undefined;

    if (cached) {
      logger.debug(`Cache hit for history: ${userId}`);
      return cached;
    }

    // Thundering herd protection: coalesce concurrent requests for the same user
    const existingPromise = this.historyPromises.get(cacheKey);
    if (existingPromise) {
      logger.debug(`Coalescing concurrent history request for: ${userId}`);
      return existingPromise;
    }

    logger.debug(`Cache miss for history: ${userId}`);
    const promise = this.underlying.getHistory(userId, workspaceId).finally(() => {
      this.historyPromises.delete(cacheKey);
    });

    this.historyPromises.set(cacheKey, promise);
    const history = await promise;

    // Cache history with 2 minute TTL
    MemoryCaches.conversation.set(cacheKey, history, 2 * 60 * 1000);

    return history;
  }

  /**
   * Adds a message and invalidates relevant caches.
   */
  async addMessage(userId: string, message: Message, workspaceId?: string): Promise<void> {
    await this.underlying.addMessage(userId, message, workspaceId);

    // Invalidate conversation cache for this user
    MemoryCaches.conversation.delete(CacheKeys.history(userId, workspaceId));
    MemoryCaches.conversation.delete(CacheKeys.summary(userId, workspaceId));
  }

  /**
   * Gets distilled memory with caching.
   * Uses 5 minute TTL for user data.
   */
  async getDistilledMemory(userId: string, workspaceId?: string): Promise<string> {
    const cacheKey = CacheKeys.distilledMemory(userId, workspaceId);
    const cached = MemoryCaches.userData.get(cacheKey) as string | undefined;

    if (cached !== undefined) {
      logger.debug(`Cache hit for distilled memory: ${userId}`);
      return cached;
    }

    logger.debug(`Cache miss for distilled memory: ${userId}`);
    const distilled = await this.underlying.getDistilledMemory(userId, workspaceId);

    // Cache distilled memory with 5 minute TTL
    MemoryCaches.userData.set(cacheKey, distilled, 5 * 60 * 1000);

    return distilled;
  }

  /**
   * Updates distilled memory and invalidates cache.
   */
  async updateDistilledMemory(userId: string, facts: string, workspaceId?: string): Promise<void> {
    await this.underlying.updateDistilledMemory(userId, facts, workspaceId);

    // Invalidate user data cache
    MemoryCaches.userData.delete(CacheKeys.distilledMemory(userId, workspaceId));
  }

  /**
   * Gets lessons with caching.
   */
  async getLessons(userId: string, workspaceId?: string): Promise<string[]> {
    const cacheKey = CacheKeys.lessons(userId, workspaceId);
    const cached = MemoryCaches.userData.get(cacheKey) as string[] | undefined;

    if (cached) {
      logger.debug(`Cache hit for lessons: ${userId}`);
      return cached;
    }

    logger.debug(`Cache miss for lessons: ${userId}`);
    const lessons = await this.underlying.getLessons(userId, workspaceId);

    // Cache lessons with 5 minute TTL
    MemoryCaches.userData.set(cacheKey, lessons, 5 * 60 * 1000);

    return lessons;
  }

  /**
   * Adds a lesson and invalidates cache.
   */
  async addLesson(
    userId: string,
    lesson: string,
    metadata?: Partial<InsightMetadata> & { tags?: string[] },
    workspaceId?: string
  ): Promise<void> {
    await this.underlying.addLesson(userId, lesson, metadata as InsightMetadata, workspaceId);

    // Invalidate lessons cache
    MemoryCaches.userData.delete(CacheKeys.lessons(userId, workspaceId));
  }

  /**
   * Gets conversation summary with caching.
   */
  async getSummary(userId: string, workspaceId?: string): Promise<string | null> {
    const cacheKey = CacheKeys.summary(userId, workspaceId);
    const cached = MemoryCaches.conversation.get(cacheKey) as string | null | undefined;

    if (cached !== undefined) {
      logger.debug(`Cache hit for summary: ${userId}`);
      return cached;
    }

    logger.debug(`Cache miss for summary: ${userId}`);
    const summary = await this.underlying.getSummary(userId, workspaceId);

    // Cache summary with 2 minute TTL
    MemoryCaches.conversation.set(cacheKey, summary, 2 * 60 * 1000);

    return summary;
  }

  /**
   * Updates summary and invalidates cache.
   */
  async updateSummary(userId: string, summary: string, workspaceId?: string): Promise<void> {
    await this.underlying.updateSummary(userId, summary, workspaceId);

    // Invalidate summary cache
    MemoryCaches.conversation.delete(CacheKeys.summary(userId, workspaceId));
  }

  /**
   * Gets global lessons with caching.
   * Uses 15 minute TTL for system-wide data.
   */
  async getGlobalLessons(limit?: number): Promise<string[]> {
    const effectiveLimit = limit ?? 5;
    const cacheKey = CacheKeys.globalLessons(effectiveLimit);
    const cached = MemoryCaches.global.get(cacheKey) as string[] | undefined;

    if (cached) {
      logger.debug(`Cache hit for global lessons (limit: ${effectiveLimit})`);
      return cached;
    }

    logger.debug(`Cache miss for global lessons (limit: ${effectiveLimit})`);
    const lessons = await this.underlying.getGlobalLessons(effectiveLimit);

    // Cache global lessons with 15 minute TTL
    MemoryCaches.global.set(cacheKey, lessons, 15 * 60 * 1000);

    return lessons;
  }

  /**
   * Adds a global lesson and invalidates cache.
   */
  async addGlobalLesson(
    lesson: string,
    metadata?: Partial<InsightMetadata>
  ): Promise<number | string> {
    const result = await this.underlying.addGlobalLesson(lesson, metadata);

    // Invalidate all global lessons caches (different limits)
    MemoryCaches.global.invalidatePattern(/^global_lessons:/);

    return result;
  }

  async searchInsights(
    userId?: string,
    query: string = '',
    category?: InsightCategory,
    limit: number = 50,
    lastEvaluatedKey?: Record<string, unknown>,
    tags?: string[],
    orgId?: string,
    workspaceId?: string
  ): Promise<{ items: MemoryInsight[]; lastEvaluatedKey?: Record<string, unknown> }> {
    // Don't cache paginated results
    if (lastEvaluatedKey) {
      return this.underlying.searchInsights(
        userId,
        query,
        category,
        limit,
        lastEvaluatedKey,
        tags,
        orgId,
        workspaceId
      );
    }

    const cacheKey = CacheKeys.insightsSearch(
      userId ?? 'global',
      query,
      category,
      tags,
      orgId,
      workspaceId
    );
    const cached = MemoryCaches.search.get(cacheKey) as
      | {
          items: MemoryInsight[];
          lastEvaluatedKey?: Record<string, unknown>;
        }
      | undefined;

    if (cached) {
      logger.debug(`Cache hit for insights search: ${cacheKey}`);
      return cached;
    }

    logger.debug(`Cache miss for insights search: ${cacheKey}`);
    const result = await this.underlying.searchInsights(
      userId,
      query,
      category,
      limit,
      undefined,
      tags,
      orgId,
      workspaceId
    );

    // Cache search results with 3 minute TTL
    MemoryCaches.search.set(cacheKey, result, 3 * 60 * 1000);

    return result;
  }

  /**
   * Adds memory and invalidates related search caches.
   */
  async addMemory(
    scopeId: string,
    category: InsightCategory | string,
    content: string,
    metadata?: Partial<InsightMetadata> & { orgId?: string; tags?: string[] },
    workspaceId?: string
  ): Promise<number | string> {
    const result = await this.underlying.addMemory(
      scopeId,
      category,
      content,
      metadata,
      workspaceId
    );

    // Invalidate search caches that might be affected
    MemoryCaches.search.invalidatePattern(new RegExp(`^insights:${scopeId}:`));

    return result;
  }

  /**
   * Gets all gaps with caching by status.
   */
  async getAllGaps(
    status: GapStatus = GapStatus.OPEN,
    workspaceId?: string
  ): Promise<MemoryInsight[]> {
    const cacheKey = CacheKeys.gapsByStatus(status, workspaceId);
    const cached = MemoryCaches.global.get(cacheKey) as MemoryInsight[] | undefined;

    if (cached) {
      logger.debug(`Cache hit for gaps by status: ${status}`);
      return cached;
    }

    logger.debug(`Cache miss for gaps by status: ${status}`);
    const gaps = await this.underlying.getAllGaps(status, workspaceId);

    // Cache gaps with 5 minute TTL
    MemoryCaches.global.set(cacheKey, gaps, 5 * 60 * 1000);

    return gaps;
  }

  /**
   * Sets a gap and invalidates cache.
   */
  async setGap(
    gapId: string,
    details: string,
    metadata?: InsightMetadata,
    workspaceId?: string
  ): Promise<void> {
    await this.underlying.setGap(gapId, details, metadata, workspaceId);

    // Invalidate gaps cache
    MemoryCaches.global.invalidatePattern(/^gaps:/);
  }

  /**
   * Updates gap status and invalidates cache.
   */
  async updateGapStatus(
    gapId: string,
    status: GapStatus,
    workspaceId?: string
  ): Promise<GapTransitionResult> {
    const result = await this.underlying.updateGapStatus(gapId, status, workspaceId);

    // Invalidate gaps cache
    MemoryCaches.global.invalidatePattern(/^gaps:/);

    return result;
  }

  /**
   * Gets user preferences with caching.
   */
  async searchInsightsForPreferences(
    userId: string,
    workspaceId?: string
  ): Promise<{ prefixed: MemoryInsight[]; raw: MemoryInsight[] }> {
    const prefixedKey = `${userId}-prefixed${workspaceId ? `-${workspaceId}` : ''}`;
    const rawKey = `${userId}-raw${workspaceId ? `-${workspaceId}` : ''}`;

    const cachedPrefixed = MemoryCaches.userData.get(prefixedKey) as MemoryInsight[] | undefined;
    const cachedRaw = MemoryCaches.userData.get(rawKey) as MemoryInsight[] | undefined;

    if (cachedPrefixed && cachedRaw) {
      logger.debug(`Cache hit for user preferences: ${userId}`);
      return { prefixed: cachedPrefixed, raw: cachedRaw };
    }

    logger.debug(`Cache miss for user preferences: ${userId}`);
    const [prefixed, raw] = await Promise.all([
      this.underlying.searchInsights(
        `USER#${userId}`,
        '*',
        InsightCategory.USER_PREFERENCE,
        50,
        undefined,
        undefined,
        undefined,
        workspaceId
      ),
      this.underlying.searchInsights(
        userId,
        '*',
        InsightCategory.USER_PREFERENCE,
        50,
        undefined,
        undefined,
        undefined,
        workspaceId
      ),
    ]);

    // Cache preferences with 5 minute TTL
    MemoryCaches.userData.set(prefixedKey, prefixed.items, 5 * 60 * 1000);
    MemoryCaches.userData.set(rawKey, raw.items, 5 * 60 * 1000);

    return { prefixed: prefixed.items, raw: raw.items };
  }

  // Delegate all other methods directly to underlying memory
  async clearHistory(userId: string, workspaceId?: string): Promise<void> {
    await this.underlying.clearHistory(userId, workspaceId);
    MemoryCaches.conversation.delete(CacheKeys.history(userId, workspaceId));
    MemoryCaches.conversation.delete(CacheKeys.summary(userId, workspaceId));
  }

  async listConversations(userId: string, workspaceId?: string): Promise<ConversationMeta[]> {
    return this.underlying.listConversations(userId, workspaceId);
  }

  async deleteConversation(userId: string, sessionId: string, workspaceId?: string): Promise<void> {
    await this.underlying.deleteConversation(userId, sessionId, workspaceId);
    MemoryCaches.conversation.delete(CacheKeys.history(userId, workspaceId));
  }

  async archiveStaleGaps(staleDays?: number, workspaceId?: string): Promise<number> {
    const result = await this.underlying.archiveStaleGaps(staleDays, workspaceId);
    MemoryCaches.global.invalidatePattern(/^gaps:/);
    return result;
  }

  async incrementGapAttemptCount(gapId: string, workspaceId?: string): Promise<number> {
    const result = await this.underlying.incrementGapAttemptCount(gapId, workspaceId);
    // 1.9 Invalidate gaps cache since attempt count changed
    MemoryCaches.global.invalidatePattern(/^gaps:/);
    return result;
  }

  async updateInsightMetadata(
    userId: string,
    timestamp: number | string,
    metadata: Partial<InsightMetadata>,
    workspaceId?: string
  ): Promise<void> {
    await this.underlying.updateInsightMetadata(userId, timestamp, metadata, workspaceId);
    MemoryCaches.search.invalidatePattern(new RegExp(`^insights:${userId}:`));
  }

  async refineMemory(
    userId: string,
    timestamp: number | string,
    content?: string,
    metadata?: Partial<InsightMetadata> & { tags?: string[] },
    workspaceId?: string
  ): Promise<void> {
    await this.underlying.refineMemory(userId, timestamp, content, metadata, workspaceId);
    // Invalidate search caches for this user
    MemoryCaches.search.invalidatePattern(new RegExp(`^insights:${userId}:`));
    // Also invalidate specific category if known
    if (metadata?.category) {
      MemoryCaches.search.invalidatePattern(new RegExp(`:${metadata.category}`));
    }
  }

  async saveConversationMeta(
    userId: string,
    sessionId: string,
    meta: Partial<ConversationMeta>,
    workspaceId?: string
  ): Promise<void> {
    await this.underlying.saveConversationMeta(userId, sessionId, meta, workspaceId);
    MemoryCaches.conversation.delete(CacheKeys.history(userId, workspaceId));
    MemoryCaches.conversation.delete(CacheKeys.summary(userId, workspaceId));
  }

  async getMemoryByTypePaginated(
    type: string,
    limit?: number,
    lastEvaluatedKey?: Record<string, unknown>,
    workspaceId?: string
  ): Promise<{ items: Record<string, unknown>[]; lastEvaluatedKey?: Record<string, unknown> }> {
    return this.underlying.getMemoryByTypePaginated(type, limit, lastEvaluatedKey, workspaceId);
  }

  async getMemoryByType(
    type: string,
    limit?: number,
    workspaceId?: string
  ): Promise<Record<string, unknown>[]> {
    return this.underlying.getMemoryByType(type, limit, workspaceId);
  }

  async getLowUtilizationMemory(limit?: number): Promise<Record<string, unknown>[]> {
    return this.underlying.getLowUtilizationMemory(limit);
  }

  async getRegisteredMemoryTypes(): Promise<string[]> {
    return this.underlying.getRegisteredMemoryTypes();
  }

  async recordMemoryHit(
    userId: string,
    timestamp: number | string,
    workspaceId?: string
  ): Promise<void> {
    await this.underlying.recordMemoryHit(userId, timestamp, workspaceId);
  }

  async saveLKGHash(hash: string): Promise<void> {
    await this.underlying.saveLKGHash(hash);
    MemoryCaches.global.delete('lkg_hash');
  }

  async getLatestLKGHash(): Promise<string | null> {
    const cacheKey = 'lkg_hash';
    const cached = MemoryCaches.global.get(cacheKey) as string | null | undefined;

    if (cached !== undefined) {
      return cached;
    }

    const hash = await this.underlying.getLatestLKGHash();
    MemoryCaches.global.set(cacheKey, hash, 15 * 60 * 1000);

    return hash;
  }

  async incrementRecoveryAttemptCount(): Promise<number> {
    return this.underlying.incrementRecoveryAttemptCount();
  }

  async resetRecoveryAttemptCount(): Promise<void> {
    await this.underlying.resetRecoveryAttemptCount();
  }

  async listByPrefix(prefix: string): Promise<Record<string, unknown>[]> {
    return this.underlying.listByPrefix(prefix);
  }

  async saveClarificationRequest(
    state: Omit<import('../types/memory').ClarificationState, 'type' | 'expiresAt' | 'timestamp'>,
    workspaceId?: string
  ): Promise<void> {
    await this.underlying.saveClarificationRequest(state, workspaceId);
  }

  async getClarificationRequest(
    traceId: string,
    agentId: string,
    workspaceId?: string
  ): Promise<import('../types/memory').ClarificationState | null> {
    return this.underlying.getClarificationRequest(traceId, agentId, workspaceId);
  }

  async updateClarificationStatus(
    traceId: string,
    agentId: string,
    status: import('../types/memory').ClarificationStatus,
    workspaceId?: string
  ): Promise<void> {
    await this.underlying.updateClarificationStatus(traceId, agentId, status, workspaceId);
  }

  async saveEscalationState(
    state: import('../types/escalation').EscalationState,
    workspaceId?: string
  ): Promise<void> {
    await this.underlying.saveEscalationState(state, workspaceId);
  }

  async getEscalationState(
    traceId: string,
    agentId: string,
    workspaceId?: string
  ): Promise<import('../types/escalation').EscalationState | null> {
    return this.underlying.getEscalationState(traceId, agentId, workspaceId);
  }

  async findExpiredClarifications(
    workspaceId?: string
  ): Promise<import('../types/memory').ClarificationState[]> {
    return this.underlying.findExpiredClarifications(workspaceId);
  }

  async incrementClarificationRetry(
    traceId: string,
    agentId: string,
    workspaceId?: string
  ): Promise<number> {
    return this.underlying.incrementClarificationRetry(traceId, agentId, workspaceId);
  }

  // Collaboration Operations

  async getCollaboration(
    collaborationId: string,
    workspaceId?: string
  ): Promise<Collaboration | null> {
    return this.underlying.getCollaboration(collaborationId, workspaceId);
  }

  async checkCollaborationAccess(
    collaborationId: string,
    participantId: string,
    participantType: ParticipantType,
    requiredRole?: CollaborationRole,
    workspaceId?: string
  ): Promise<boolean> {
    return this.underlying.checkCollaborationAccess(
      collaborationId,
      participantId,
      participantType,
      requiredRole,
      workspaceId
    );
  }

  async closeCollaboration(
    collaborationId: string,
    actorId: string,
    actorType: ParticipantType,
    workspaceId?: string
  ): Promise<void> {
    return this.underlying.closeCollaboration(collaborationId, actorId, actorType, workspaceId);
  }

  async createCollaboration(
    ownerId: string,
    ownerType: ParticipantType,
    input: import('../types/collaboration').CreateCollaborationInput,
    workspaceId?: string
  ): Promise<Collaboration> {
    return this.underlying.createCollaboration(ownerId, ownerType, input, workspaceId);
  }

  async listCollaborationsForParticipant(
    participantId: string,
    participantType: ParticipantType,
    workspaceId?: string
  ): Promise<
    Array<{
      collaborationId: string;
      role: CollaborationRole;
      collaborationName: string;
    }>
  > {
    return this.underlying.listCollaborationsForParticipant(
      participantId,
      participantType,
      workspaceId
    );
  }

  async recordFailurePattern(
    scopeId: string,
    content: string,
    metadata?: Partial<InsightMetadata>,
    workspaceId?: string
  ): Promise<number | string> {
    const result = await this.underlying.recordFailurePattern(
      scopeId,
      content,
      metadata,
      workspaceId
    );
    MemoryCaches.search.invalidatePattern(/^insights:/);
    return result;
  }

  async getFailurePatterns(
    scopeId: string,
    context?: string,
    limit?: number,
    workspaceId?: string
  ): Promise<MemoryInsight[]> {
    return this.underlying.getFailurePatterns(scopeId, context, limit, workspaceId);
  }

  async acquireGapLock(
    gapId: string,
    agentId: string,
    ttlMs?: number,
    workspaceId?: string
  ): Promise<boolean> {
    return this.underlying.acquireGapLock(gapId, agentId, ttlMs, workspaceId);
  }

  async releaseGapLock(
    gapId: string,
    agentId: string,
    expectedVersion?: number,
    force?: boolean,
    workspaceId?: string
  ): Promise<void> {
    await this.underlying.releaseGapLock(gapId, agentId, expectedVersion, force, workspaceId);
  }

  async getGapLock(
    gapId: string,
    workspaceId?: string
  ): Promise<{ agentId: string; expiresAt: number; lockVersion?: number } | null> {
    return this.underlying.getGapLock(gapId, workspaceId);
  }

  async getGap(gapId: string, workspaceId?: string): Promise<MemoryInsight | null> {
    const cacheKey = CacheKeys.gap(gapId, workspaceId);
    const cached = MemoryCaches.global.get(cacheKey) as MemoryInsight | null | undefined;

    if (cached !== undefined) {
      return cached;
    }

    const gap = await this.underlying.getGap(gapId, workspaceId);
    MemoryCaches.global.set(cacheKey, gap, 5 * 60 * 1000);
    return gap;
  }

  async updateGapMetadata(
    gapId: string,
    metadata: Partial<InsightMetadata>,
    workspaceId?: string
  ): Promise<void> {
    await this.underlying.updateGapMetadata(gapId, metadata, workspaceId);
    // Invalidate gaps cache since metadata changed
    MemoryCaches.global.invalidatePattern(/^gaps:/);
    MemoryCaches.global.delete(CacheKeys.gap(gapId, workspaceId));
  }

  async recordFailedPlan(
    planHash: string,
    planContent: string,
    gapIds: string[],
    failureReason: string,
    metadata?: Partial<InsightMetadata>,
    workspaceId?: string
  ): Promise<number | string> {
    const result = await this.underlying.recordFailedPlan(
      planHash,
      planContent,
      gapIds,
      failureReason,
      metadata,
      workspaceId
    );
    MemoryCaches.search.invalidatePattern(/^insights:/);
    return result;
  }

  async getFailedPlans(limit?: number, workspaceId?: string): Promise<MemoryInsight[]> {
    return this.underlying.getFailedPlans(limit, workspaceId);
  }

  /**
   * Gets cache statistics for monitoring.
   */
  getCacheStats() {
    return getCacheStatsSummary();
  }

  /**
   * Clears all caches. Useful for testing or forced refresh.
   */
  clearAllCaches(): void {
    MemoryCaches.userData.clear();
    MemoryCaches.conversation.clear();
    MemoryCaches.global.clear();
    MemoryCaches.search.clear();
    logger.info('All memory caches cleared');
  }

  /**
   * Invalidates all cache entries for a specific user.
   * Should be called when user permissions, roles, or workspace memberships change.
   */
  invalidateUser(userId: string): void {
    logger.info(`Invalidating all caches for user: ${userId}`);
    MemoryCaches.userData.invalidateUser(userId);
    MemoryCaches.conversation.invalidateUser(userId);
    MemoryCaches.search.invalidatePattern(new RegExp(`(^|:)${userId}(:|$)`));
  }

  /**
   * Invalidates global caches that might contain user-sensitive data.
   */
  invalidateGlobalUserCaches(): void {
    MemoryCaches.global.invalidatePattern(/^gaps:/);
    MemoryCaches.search.invalidatePattern(/^insights:/);
  }
}
