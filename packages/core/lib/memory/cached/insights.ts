import type { IMemory } from '../../types/memory';
import { MemoryCaches, CacheKeys } from '../cache';
import {
  MemoryInsight,
  InsightCategory,
  InsightMetadata,
  ContextualScope,
} from '../../types/index';
import { CACHE_TTL } from '../../constants/memory';

/**
 * Handles insight-related memory operations (lessons, memories, patterns)
 * for the CachedMemory provider.
 */
export class MemoryInsights {
  constructor(private readonly underlying: IMemory) {}

  async getDistilledMemory(userId: string, scope?: string | ContextualScope): Promise<string> {
    const cacheKey = CacheKeys.distilledMemory(userId, scope);
    const cached = MemoryCaches.userData.get(cacheKey) as string | undefined;

    if (cached !== undefined) return cached;

    const distilled = await this.underlying.getDistilledMemory(userId, scope);
    MemoryCaches.userData.set(cacheKey, distilled, CACHE_TTL.USER_DATA);
    return distilled;
  }

  async updateDistilledMemory(
    userId: string,
    facts: string,
    scope?: string | ContextualScope
  ): Promise<void> {
    await this.underlying.updateDistilledMemory(userId, facts, scope);
    MemoryCaches.userData.delete(CacheKeys.distilledMemory(userId, scope));
  }

  async getLessons(userId: string, scope?: string | ContextualScope): Promise<string[]> {
    const cacheKey = CacheKeys.lessons(userId, scope);
    const cached = MemoryCaches.userData.get(cacheKey) as string[] | undefined;

    if (cached) return cached;

    const lessons = await this.underlying.getLessons(userId, scope);
    MemoryCaches.userData.set(cacheKey, lessons, CACHE_TTL.USER_DATA);
    return lessons;
  }

  async addLesson(
    userId: string,
    lesson: string,
    metadata?: Partial<InsightMetadata> & { tags?: string[] },
    scope?: string | ContextualScope
  ): Promise<void> {
    await this.underlying.addLesson(userId, lesson, metadata as InsightMetadata, scope);
    MemoryCaches.userData.delete(CacheKeys.lessons(userId, scope));
  }

  async getGlobalLessons(limit?: number): Promise<string[]> {
    const effectiveLimit = limit ?? 5;
    const cacheKey = CacheKeys.globalLessons(effectiveLimit);
    const cached = MemoryCaches.global.get(cacheKey) as string[] | undefined;

    if (cached) return cached;

    const lessons = await this.underlying.getGlobalLessons(effectiveLimit);
    MemoryCaches.global.set(cacheKey, lessons, CACHE_TTL.GLOBAL);
    return lessons;
  }

  async addGlobalLesson(
    lesson: string,
    metadata?: Partial<InsightMetadata>
  ): Promise<number | string> {
    const result = await this.underlying.addGlobalLesson(lesson, metadata);
    MemoryCaches.global.invalidatePattern(/^global_lessons:/);
    return result;
  }

  async searchInsights(
    queryOrUserId?:
      | string
      | {
          query?: string;
          tags?: string[];
          category?: InsightCategory;
          limit?: number;
          scope?: ContextualScope;
        },
    queryText?: string,
    category?: InsightCategory,
    limit?: number,
    lastEvaluatedKey?: Record<string, unknown>,
    tags?: string[],
    orgId?: string,
    scope?: string | ContextualScope
  ): Promise<{ items: MemoryInsight[]; lastEvaluatedKey?: Record<string, unknown> }> {
    let effectiveUserId: string;
    let effectiveQuery: string;
    let effectiveCategory: InsightCategory | undefined;
    let effectiveTags: string[] | undefined;
    let effectiveScope: string | ContextualScope | undefined;

    if (typeof queryOrUserId === 'object' && queryOrUserId !== null) {
      effectiveUserId = ((queryOrUserId as Record<string, unknown>).userId as string) || '';
      effectiveQuery = ((queryOrUserId as Record<string, unknown>).query as string) || '';
      effectiveCategory = queryOrUserId.category;
      effectiveTags = queryOrUserId.tags;
      effectiveScope = queryOrUserId.scope;
    } else {
      effectiveUserId = (queryOrUserId as string) || '';
      effectiveQuery = queryText || '';
      effectiveCategory = category;
      effectiveTags = tags;
      effectiveScope = scope;
    }

    const cacheKey = CacheKeys.insightsSearch(
      effectiveUserId,
      effectiveQuery,
      effectiveCategory,
      effectiveTags,
      orgId,
      effectiveScope
    );

    const cached = MemoryCaches.search.get(cacheKey) as
      | { items: MemoryInsight[]; lastEvaluatedKey?: Record<string, unknown> }
      | undefined;
    if (cached) return cached;

    const result = await this.underlying.searchInsights(
      queryOrUserId,
      queryText,
      category,
      limit,
      lastEvaluatedKey,
      tags,
      orgId,
      scope
    );

    MemoryCaches.search.set(cacheKey, result, CACHE_TTL.SEARCH);
    return result;
  }

  async addMemory(
    scopeId: string,
    category: InsightCategory | string,
    content: string,
    metadata?: Partial<InsightMetadata> & { orgId?: string; tags?: string[] },
    scope?: string | ContextualScope
  ): Promise<number | string> {
    const result = await this.underlying.addMemory(scopeId, category, content, metadata, scope);
    MemoryCaches.search.invalidatePattern(new RegExp(`^insights:${scopeId}:`));
    return result;
  }

  async searchInsightsForPreferences(
    userId: string,
    scope?: string | ContextualScope
  ): Promise<{ prefixed: MemoryInsight[]; raw: MemoryInsight[] }> {
    const prefixedKey = `prefs:${userId}:prefixed${CacheKeys.normalizeScope(scope)}`;
    const rawKey = `prefs:${userId}:raw${CacheKeys.normalizeScope(scope)}`;

    const cachedPrefixed = MemoryCaches.userData.get(prefixedKey) as MemoryInsight[] | undefined;
    const cachedRaw = MemoryCaches.userData.get(rawKey) as MemoryInsight[] | undefined;

    if (cachedPrefixed && cachedRaw) return { prefixed: cachedPrefixed, raw: cachedRaw };

    const [prefixed, raw] = await Promise.all([
      this.underlying.searchInsights(
        `USER#${userId}`,
        '*',
        InsightCategory.USER_PREFERENCE,
        50,
        undefined,
        undefined,
        undefined,
        scope
      ),
      this.underlying.searchInsights(
        userId,
        '*',
        InsightCategory.USER_PREFERENCE,
        50,
        undefined,
        undefined,
        undefined,
        scope
      ),
    ]);

    MemoryCaches.userData.set(prefixedKey, prefixed.items, CACHE_TTL.USER_DATA);
    MemoryCaches.userData.set(rawKey, raw.items, CACHE_TTL.USER_DATA);
    return { prefixed: prefixed.items, raw: raw.items };
  }

  async updateInsightMetadata(
    userId: string,
    timestamp: number | string,
    metadata: Partial<InsightMetadata>,
    scope?: string | ContextualScope
  ): Promise<void> {
    await this.underlying.updateInsightMetadata(userId, timestamp, metadata, scope);
    MemoryCaches.search.invalidatePattern(new RegExp(`^insights:${userId}:`));
  }

  async refineMemory(
    userId: string,
    timestamp: number | string,
    content?: string,
    metadata?: Partial<InsightMetadata> & { tags?: string[] },
    scope?: string | ContextualScope
  ): Promise<void> {
    await this.underlying.refineMemory(userId, timestamp, content, metadata, scope);
    MemoryCaches.search.invalidatePattern(new RegExp(`^insights:${userId}:`));
    if (metadata?.category)
      MemoryCaches.search.invalidatePattern(new RegExp(`:${metadata.category}`));
  }
}
