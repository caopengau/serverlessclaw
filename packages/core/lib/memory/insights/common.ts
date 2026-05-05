import { TIME } from '../../constants';
import { InsightCategory, InsightMetadata } from '../../types/memory';

const INSIGHT_TTL_DAYS = 30;

/**
 * Normalizes tags to ensure consistent searching.
 */
export function normalizeTags(tags: string[] = []): string[] {
  return Array.from(new Set(tags.map((t) => t.toLowerCase().trim())));
}

/**
 * Creates standardized metadata for a new insight.
 */
export function createMetadata(
  partial: Partial<InsightMetadata> = {},
  timestamp: string | number
): InsightMetadata {
  return {
    category: (partial.category ?? InsightCategory.STRATEGIC_GAP) as InsightCategory | string,
    confidence: partial.confidence || 5,
    impact: partial.impact || 5,
    complexity: partial.complexity || 5,
    risk: partial.risk || 5,
    urgency: partial.urgency || 5,
    priority: partial.priority || 5,
    sourceTraceId: partial.sourceTraceId || 'manual',
    sourceSessionId: partial.sourceSessionId || 'manual',
    expiresAt:
      partial.expiresAt ||
      Math.floor((Date.now() + (INSIGHT_TTL_DAYS || 30) * TIME.MS_PER_DAY) / 1000),
    hitCount: partial.hitCount || 0,
    lastAccessed:
      partial.lastAccessed || (typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp),
    lastValidatedAt: typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp,
  };
}
