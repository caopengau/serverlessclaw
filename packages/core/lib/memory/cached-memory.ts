/**
 * @module CachedMemory
 * @description Wrapper for DynamoMemory that adds LRU caching for frequently accessed items.
 */

import {
  IMemory,
  Message,
  MemoryInsight,
  InsightCategory,
  GapStatus,
  GapTransitionResult,
  ConversationMeta,
  ClarificationState,
  ClarificationStatus,
  InsightMetadata,
  ContextualScope,
} from '../types/index';
import type { EscalationState } from '../types/escalation';
import type { CollaborationRole, ParticipantType } from '../types/collaboration';
import { DynamoMemory } from './dynamo-memory';
import { getCacheStatsSummary } from './cache';

import { MemoryCollaboration } from './cached/collaboration';
import { MemoryGaps } from './cached/gaps';
import { MemoryInsights } from './cached/insights';
import { MemoryConversation } from './cached/conversation';
import { MemorySystem } from './cached/system';

type Scope = string | ContextualScope;

/**
 * Cached memory provider that wraps DynamoMemory with LRU caching.
 * Implements cache-aside pattern with proper invalidation on writes.
 */
export class CachedMemory implements IMemory {
  private collaboration: MemoryCollaboration;
  private gaps: MemoryGaps;
  private insights: MemoryInsights;
  private conversation: MemoryConversation;
  private system: MemorySystem;

  constructor(private readonly underlying: DynamoMemory) {
    this.collaboration = new MemoryCollaboration(underlying);
    this.gaps = new MemoryGaps(underlying);
    this.insights = new MemoryInsights(underlying);
    this.conversation = new MemoryConversation(underlying);
    this.system = new MemorySystem(underlying);
  }

  // --- CORE CONVERSATION OPERATIONS ---
  async getHistory(userId: string, scope?: Scope): Promise<Message[]> {
    return this.conversation.getHistory(userId, scope);
  }
  async addMessage(userId: string, message: Message, scope?: Scope): Promise<void> {
    return this.conversation.addMessage(userId, message, scope);
  }
  async getSummary(userId: string, scope?: Scope): Promise<string | null> {
    return this.conversation.getSummary(userId, scope);
  }
  async updateSummary(userId: string, summary: string, scope?: Scope): Promise<void> {
    return this.conversation.updateSummary(userId, summary, scope);
  }
  async listConversations(userId: string, scope?: Scope): Promise<ConversationMeta[]> {
    return this.conversation.listConversations(userId, scope);
  }
  async deleteConversation(userId: string, sessionId: string, scope?: Scope): Promise<void> {
    return this.conversation.deleteConversation(userId, sessionId, scope);
  }
  async saveConversationMeta(
    userId: string,
    sessionId: string,
    meta: Partial<ConversationMeta>,
    scope?: Scope
  ): Promise<void> {
    return this.conversation.saveConversationMeta(userId, sessionId, meta, scope);
  }
  async getSessionMetadata(sessionId: string, scope?: Scope): Promise<ConversationMeta | null> {
    return this.conversation.getSessionMetadata(sessionId, scope);
  }

  // --- USER DATA & INSIGHTS ---
  async getDistilledMemory(userId: string, scope?: Scope): Promise<string> {
    return this.insights.getDistilledMemory(userId, scope);
  }
  async updateDistilledMemory(userId: string, facts: string, scope?: Scope): Promise<void> {
    return this.insights.updateDistilledMemory(userId, facts, scope);
  }
  async getLessons(userId: string, scope?: Scope): Promise<string[]> {
    return this.insights.getLessons(userId, scope);
  }
  async addLesson(
    userId: string,
    lesson: string,
    metadata?: Partial<InsightMetadata> & { tags?: string[] },
    scope?: Scope
  ): Promise<void> {
    return this.insights.addLesson(userId, lesson, metadata, scope);
  }
  async getGlobalLessons(limit?: number): Promise<string[]> {
    return this.insights.getGlobalLessons(limit);
  }
  async addGlobalLesson(
    lesson: string,
    metadata?: Partial<InsightMetadata>
  ): Promise<number | string> {
    return this.insights.addGlobalLesson(lesson, metadata);
  }
  async searchInsights(
    queryOrUserId?: any,
    queryText?: string,
    category?: InsightCategory,
    limit?: number,
    lastEvaluatedKey?: any,
    tags?: string[],
    orgId?: string,
    scope?: Scope
  ): Promise<any> {
    return this.insights.searchInsights(
      queryOrUserId,
      queryText,
      category,
      limit,
      lastEvaluatedKey,
      tags,
      orgId,
      scope
    );
  }
  async recordFailurePattern(
    planHash: string,
    planContent: string,
    gapIds: string[],
    failureReason: string,
    metadata?: any,
    scope?: Scope
  ): Promise<any> {
    return this.underlying.recordFailurePattern(
      planHash,
      planContent,
      gapIds,
      failureReason,
      metadata,
      scope
    );
  }
  async getFailurePatterns(limit?: number, scope?: Scope): Promise<MemoryInsight[]> {
    return this.underlying.getFailurePatterns(limit, scope);
  }
  async addMemory(
    scopeId: string,
    category: any,
    content: string,
    metadata?: any,
    scope?: Scope
  ): Promise<any> {
    return this.insights.addMemory(scopeId, category, content, metadata, scope);
  }
  async saveDistilledRecoveryLog(traceId: string, task: string): Promise<void> {
    return this.underlying.saveDistilledRecoveryLog(traceId, task);
  }
  async searchInsightsForPreferences(userId: string, scope?: Scope): Promise<any> {
    return this.insights.searchInsightsForPreferences(userId, scope);
  }
  async updateInsightMetadata(
    userId: string,
    timestamp: any,
    metadata: any,
    scope?: Scope
  ): Promise<void> {
    return this.insights.updateInsightMetadata(userId, timestamp, metadata, scope);
  }
  async refineMemory(
    userId: string,
    timestamp: any,
    content?: string,
    metadata?: any,
    scope?: Scope
  ): Promise<void> {
    return this.insights.refineMemory(userId, timestamp, content, metadata, scope);
  }

  // --- GAP & PLAN OPERATIONS ---
  async getAllGaps(status: GapStatus = GapStatus.OPEN, scope?: Scope): Promise<MemoryInsight[]> {
    return this.gaps.getAllGaps(status, scope);
  }
  async setGap(
    gapId: string,
    details: string,
    metadata?: InsightMetadata,
    scope?: Scope
  ): Promise<void> {
    return this.gaps.setGap(gapId, details, metadata, scope);
  }
  async updateGapStatus(
    gapId: string,
    status: GapStatus,
    scope?: Scope,
    metadata?: any
  ): Promise<GapTransitionResult> {
    return this.gaps.updateGapStatus(gapId, status, scope, metadata);
  }
  async archiveStaleGaps(staleDays?: number, scope?: Scope): Promise<number> {
    return this.gaps.archiveStaleGaps(staleDays, scope);
  }
  async cullResolvedGaps(thresholdDays?: number, scope?: Scope): Promise<number> {
    return this.gaps.cullResolvedGaps(thresholdDays, scope);
  }
  async incrementGapAttemptCount(gapId: string, scope?: Scope): Promise<number> {
    return this.gaps.incrementGapAttemptCount(gapId, scope);
  }
  async updateGapMetadata(gapId: string, metadata: any, scope?: Scope): Promise<void> {
    return this.gaps.updateGapMetadata(gapId, metadata, scope);
  }
  async getGap(gapId: string, scope?: Scope): Promise<MemoryInsight | null> {
    return this.gaps.getGap(gapId, scope);
  }
  async acquireGapLock(
    gapId: string,
    agentId: string,
    ttlMs?: number,
    scope?: Scope
  ): Promise<boolean> {
    return this.gaps.acquireGapLock(gapId, agentId, ttlMs, scope);
  }
  async releaseGapLock(
    gapId: string,
    agentId: string,
    expectedVersion?: number,
    force?: boolean,
    scope?: Scope
  ): Promise<void> {
    return this.gaps.releaseGapLock(gapId, agentId, expectedVersion, force, scope);
  }
  async getGapLock(gapId: string): Promise<any> {
    return this.gaps.getGapLock(gapId);
  }

  // --- COLLABORATION OPERATIONS ---
  async getCollaboration(id: string, scope?: Scope) {
    return this.collaboration.getCollaboration(id, scope);
  }
  async checkCollaborationAccess(
    id: string,
    participantId: string,
    participantType: ParticipantType,
    role?: CollaborationRole,
    scope?: Scope
  ) {
    return this.collaboration.checkCollaborationAccess(
      id,
      participantId,
      participantType,
      role,
      scope
    );
  }
  async closeCollaboration(id: string, agentId: string, agentType: ParticipantType, scope?: Scope) {
    return this.collaboration.closeCollaboration(id, agentId, agentType, scope);
  }
  async createCollaboration(
    ownerId: string,
    ownerType: ParticipantType,
    input: any,
    scope?: Scope
  ) {
    return this.collaboration.createCollaboration(ownerId, ownerType, input, scope);
  }
  async listCollaborationsForParticipant(
    participantId: string,
    participantType: ParticipantType,
    scope?: Scope
  ) {
    return this.collaboration.listCollaborationsForParticipant(
      participantId,
      participantType,
      scope
    );
  }
  async getConfig(key: string): Promise<unknown> {
    return this.system.getConfig(key);
  }
  async findStaleCollaborations(defaultTimeoutMs: number, scope?: Scope): Promise<any[]> {
    return this.system.findStaleCollaborations(defaultTimeoutMs, scope);
  }
  async transitToCollaboration(
    userId: string,
    scope: Scope,
    sourceSessionId: string,
    invitedAgentIds: string[],
    name?: string
  ): Promise<any> {
    return this.collaboration.transitToCollaboration(
      userId,
      scope,
      sourceSessionId,
      invitedAgentIds,
      name
    );
  }
  getScopedUserId(userId: string, scope?: Scope): string {
    return this.system.getScopedUserId(userId, scope);
  }

  // --- SYSTEM OPERATIONS ---
  async getMemoryByTypePaginated(type: string, limit?: number, lastKey?: any, scope?: Scope) {
    return this.system.getMemoryByTypePaginated(type, limit, lastKey, scope);
  }
  async getMemoryByType(type: string, limit?: number, scope?: Scope) {
    return this.system.getMemoryByType(type, limit, scope);
  }
  async getLowUtilizationMemory(limit?: number): Promise<any[]> {
    return this.system.getLowUtilizationMemory(limit);
  }
  async getRegisteredMemoryTypes() {
    return this.system.getRegisteredMemoryTypes();
  }
  async recordMemoryHit(userId: string, timestamp: any, scope?: Scope) {
    return this.system.recordMemoryHit(userId, timestamp, scope);
  }
  async saveLKGHash(hash: string) {
    return this.system.saveLKGHash(hash);
  }
  async getLatestLKGHash() {
    return this.system.getLatestLKGHash();
  }
  async incrementRecoveryAttemptCount() {
    return this.system.incrementRecoveryAttemptCount();
  }
  async resetRecoveryAttemptCount() {
    return this.system.resetRecoveryAttemptCount();
  }
  async listByPrefix(prefix: string) {
    return this.system.listByPrefix(prefix);
  }
  async queryItems(params: any): Promise<any[]> {
    return this.system.queryItems(params);
  }
  async putItem(item: any, params?: any): Promise<void> {
    return this.system.putItem(item, params);
  }
  async saveClarificationRequest(state: ClarificationState, scope?: Scope) {
    return this.system.saveClarificationRequest(state, scope);
  }
  async getClarificationRequest(traceId: string, agentId: string, scope?: Scope) {
    return this.system.getClarificationRequest(traceId, agentId, scope);
  }
  async updateClarificationStatus(
    traceId: string,
    agentId: string,
    status: ClarificationStatus,
    scope?: Scope
  ) {
    return this.system.updateClarificationStatus(traceId, agentId, status, scope);
  }
  async saveEscalationState(state: EscalationState, scope?: Scope) {
    return this.system.saveEscalationState(state, scope);
  }
  async getEscalationState(traceId: string, agentId: string, scope?: Scope) {
    return this.system.getEscalationState(traceId, agentId, scope);
  }
  async findExpiredClarifications(scope?: Scope) {
    return this.system.findExpiredClarifications(scope);
  }
  async incrementClarificationRetry(traceId: string, agentId: string, scope?: Scope) {
    return this.system.incrementClarificationRetry(traceId, agentId, scope);
  }

  // --- UTILS ---
  async clearHistory(userId: string, scope?: Scope): Promise<void> {
    return this.conversation.clearHistory(userId, scope);
  }
  getCacheStats() {
    return getCacheStatsSummary();
  }
  clearAllCaches(): void {
    return this.system.clearAllCaches();
  }
  invalidateUser(userId: string): void {
    return this.system.invalidateUser(userId);
  }
  invalidateGlobalUserCaches(): void {
    return this.system.invalidateGlobalUserCaches();
  }
}
