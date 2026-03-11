import { Message } from './llm';

export enum InsightCategory {
  USER_PREFERENCE = 'user_preference',
  TACTICAL_LESSON = 'tactical_lesson',
  STRATEGIC_GAP = 'strategic_gap',
  SYSTEM_KNOWLEDGE = 'system_knowledge',
}

export interface InsightMetadata {
  category: InsightCategory;
  confidence: number;
  impact: number;
  complexity: number;
  risk: number;
  urgency: number;
  priority: number;
  expiration?: number;
}

export interface MemoryInsight {
  id: string;
  content: string;
  metadata: InsightMetadata;
  timestamp: number;
}

export interface ConversationMeta {
  sessionId: string;
  title: string;
  lastMessage: string;
  updatedAt: number;
}

/**
 * Interface for managing conversation history
 */
export interface IHistoryStore {
  getHistory(userId: string): Promise<Message[]>;
  addMessage(userId: string, message: Message): Promise<void>;
  clearHistory(userId: string): Promise<void>;
  listConversations(userId: string): Promise<ConversationMeta[]>;
  saveConversationMeta(
    userId: string,
    sessionId: string,
    meta: Partial<ConversationMeta>
  ): Promise<void>;
}

/**
 * Interface for managing distilled knowledge and lessons
 */
export interface IKnowledgeStore {
  getDistilledMemory(userId: string): Promise<string>;
  updateDistilledMemory(userId: string, facts: string): Promise<void>;
  addLesson(userId: string, lesson: string, metadata?: InsightMetadata): Promise<void>;
  getLessons(userId: string): Promise<string[]>;
}

/**
 * Interface for managing capability gaps and strategic insights
 */
export interface IGapManager {
  setGap(gapId: string, details: string, metadata?: InsightMetadata): Promise<void>;
  getAllGaps(status?: string): Promise<MemoryInsight[]>;
  updateGapStatus(gapId: string, status: string): Promise<void>;
}

/**
 * Unified interface for agent memory, composed of specialized stores
 */
export interface IMemory extends IHistoryStore, IKnowledgeStore, IGapManager {
  searchInsights(
    userId: string,
    query: string,
    category?: InsightCategory
  ): Promise<MemoryInsight[]>;

  updateInsightMetadata(
    userId: string,
    timestamp: number,
    metadata: Partial<InsightMetadata>
  ): Promise<void>;
}
