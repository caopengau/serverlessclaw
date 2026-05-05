import type { IMemory, ContextualScope } from '../../types/memory';
import { ClarificationState, ClarificationStatus } from '../../types/index';
import type { EscalationState } from '../../types/escalation';
import { logger } from '../../logger';
import { MemoryCaches } from '../cache';

/**
 * Handles system-related memory operations (clarifications, escalations, recovery)
 * for the CachedMemory provider.
 */
export class MemorySystem {
  constructor(private readonly underlying: IMemory) {}

  async getMemoryByTypePaginated(
    t: string,
    l?: number,
    k?: Record<string, unknown>,
    scope?: string | ContextualScope
  ) {
    return this.underlying.getMemoryByTypePaginated(t, l, k, scope);
  }
  async getMemoryByType(t: string, l?: number, scope?: string | ContextualScope) {
    return this.underlying.getMemoryByType(t, l, scope);
  }
  async getLowUtilizationMemory(l?: number): Promise<Record<string, unknown>[]> {
    return this.underlying.getLowUtilizationMemory(l);
  }
  async getRegisteredMemoryTypes() {
    return this.underlying.getRegisteredMemoryTypes();
  }
  async recordMemoryHit(u: string, t: number | string, scope?: string | ContextualScope) {
    return this.underlying.recordMemoryHit(u, t, scope);
  }
  async saveLKGHash(h: string) {
    await this.underlying.saveLKGHash(h);
    MemoryCaches.global.delete('lkg_hash');
  }
  async getLatestLKGHash() {
    const cached = MemoryCaches.global.get('lkg_hash') as string | undefined;
    if (cached) return cached;
    
    const hash = await this.underlying.getLatestLKGHash();
    if (hash) MemoryCaches.global.set('lkg_hash', hash);
    return hash;
  }
  async incrementRecoveryAttemptCount() {
    return this.underlying.incrementRecoveryAttemptCount();
  }
  async resetRecoveryAttemptCount() {
    return this.underlying.resetRecoveryAttemptCount();
  }
  async listByPrefix(p: string) {
    return this.underlying.listByPrefix(p);
  }

  async saveClarificationRequest(s: ClarificationState, scope?: string | ContextualScope) {
    return this.underlying.saveClarificationRequest(s, scope);
  }
  async getClarificationRequest(t: string, a: string, scope?: string | ContextualScope) {
    return this.underlying.getClarificationRequest(t, a, scope);
  }
  async updateClarificationStatus(
    t: string,
    a: string,
    status: ClarificationStatus,
    scope?: string | ContextualScope
  ) {
    return this.underlying.updateClarificationStatus(t, a, status, scope);
  }
  async saveEscalationState(s: EscalationState, scope?: string | ContextualScope) {
    return this.underlying.saveEscalationState(s, scope);
  }
  async getEscalationState(t: string, a: string, scope?: string | ContextualScope) {
    return this.underlying.getEscalationState(t, a, scope);
  }
  async findExpiredClarifications(scope?: string | ContextualScope) {
    return this.underlying.findExpiredClarifications(scope);
  }
  async incrementClarificationRetry(t: string, a: string, scope?: string | ContextualScope) {
    return this.underlying.incrementClarificationRetry(t, a, scope);
  }

  /**
   * Helper to derive a workspace-scoped userId for DynamoDB partition keys.
   */
  getScopedUserId(userId: string, scope?: string | ContextualScope): string {
    return this.underlying.getScopedUserId(userId, scope);
  }

  async findStaleCollaborations(
    defaultTimeoutMs: number,
    scope?: string | ContextualScope
  ): Promise<import('../../types/collaboration').Collaboration[]> {
    return this.underlying.findStaleCollaborations(defaultTimeoutMs, scope);
  }

  /**
   * LEGACY: Retrieves a raw configuration JSON.
   */
  async getConfig(key: string): Promise<unknown> {
    const provider = this.underlying as unknown as {
      getConfig?: (key: string) => Promise<unknown>;
    };
    return provider.getConfig?.(key);
  }

  async queryItems(params: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    return this.underlying.queryItems(params);
  }

  async putItem(
    item: Record<string, unknown>,
    params?: Partial<Record<string, unknown>>
  ): Promise<void> {
    return this.underlying.putItem(item, params as Partial<Record<string, unknown>>);
  }

  clearAllCaches(): void {
    MemoryCaches.userData.clear();
    MemoryCaches.conversation.clear();
    MemoryCaches.global.clear();
    MemoryCaches.search.clear();
    logger.info('All memory caches cleared');
  }

  invalidateUser(userId: string): void {
    logger.info(`Invalidating all caches for user: ${userId}`);
    MemoryCaches.userData.invalidateUser(userId);
    MemoryCaches.conversation.invalidateUser(userId);
    MemoryCaches.search.invalidatePattern(new RegExp(`(^|:)${userId}(:|$)`));
  }

  invalidateGlobalUserCaches(): void {
    MemoryCaches.global.invalidatePattern(/^gaps:/);
    MemoryCaches.search.invalidatePattern(/^insights:/);
  }
}
