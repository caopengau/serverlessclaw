import { InsightMetadata, MemoryInsight, InsightCategory, GapStatus } from '../../types/index';

/**
 * Creates a standard MemoryInsight metadata object with defaults.
 */
export function createMetadata(
  partial: Partial<InsightMetadata> = {},
  timestamp: string | number = Date.now()
): InsightMetadata {
  return {
    category: (partial.category ?? InsightCategory.STRATEGIC_GAP) as InsightCategory | string,
    confidence: partial.confidence || 5,
    impact: partial.impact || 5,
    complexity: partial.complexity || 5,
    hitCount: 0,
    lastAccessed: typeof timestamp === 'number' ? timestamp : Date.now(),
    createdAt: typeof timestamp === 'number' ? timestamp : Date.now(),
    updatedAt: Date.now(),
    ...partial,
  } as InsightMetadata;
}

/**
 * Internal mapper from DynamoDB record to MemoryInsight.
 */
export function mapToInsight(item: Record<string, unknown>, defaultType: string): MemoryInsight {
  return {
    id: item['userId'] as string,
    type: (item['type'] as string) || defaultType,
    content: item['content'] as string,
    timestamp: item['timestamp'] as number | string,
    metadata: (item['metadata'] as InsightMetadata) || { category: defaultType },
    workspaceId: item['workspaceId'] as string | undefined,
    status: item['status'] as GapStatus | undefined,
    createdAt: (item['createdAt'] as number) || (item['timestamp'] as number) || Date.now(),
  };
}
