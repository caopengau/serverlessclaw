import { memorySchema } from '../definitions/memory';
import { InsightCategory } from '../../../lib/types/memory';
import { formatErrorMessage } from '../../../lib/utils/error';
import { normalizeTags } from '../../../lib/memory/utils';
import { logger } from '../../../lib/logger';
import { getMemory } from '../utils';

/**
 * Recalls distilled knowledge and lessons from DynamoDB memory.
 */
export const recallKnowledge = {
  ...memorySchema.recallKnowledge,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const { query, category, tags, minImpact, minConfidence, workspaceId } = args as {
      userId: string;
      query: string;
      category: InsightCategory;
      tags?: string[];
      minImpact?: number;
      minConfidence?: number;
      workspaceId?: string;
    };
    const memory = getMemory();

    const searchResponse = await memory.searchInsights({
      query,
      tags,
      category,
      limit: 50,
      scope: { workspaceId },
    });

    let results = searchResponse.items;

    if (minImpact !== undefined) {
      results = results.filter((r) => (r.metadata.impact ?? 0) >= minImpact);
    }
    if (minConfidence !== undefined) {
      results = results.filter((r) => (r.metadata.confidence ?? 0) >= minConfidence);
    }

    if (results.length === 0) return 'No relevant knowledge found.';

    Promise.all(results.map((r) => memory.recordMemoryHit(r.id, r.timestamp))).catch((e) =>
      logger.warn('Failed to track memory hits:', e)
    );

    return results
      .map(
        (r) =>
          `[${r.metadata.category.toUpperCase()}] (Impact: ${r.metadata.impact}/10, Urgency: ${r.metadata.urgency}/10) ${r.content}`
      )
      .join('\n');
  },
};

/**
 * Directly saves project knowledge into the system memory.
 */
export const saveMemory = {
  ...memorySchema.saveMemory,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const { content, category, userId, tags, orgId, workspaceId } = args as {
      content: string;
      category: InsightCategory;
      userId: string;
      tags?: string[];
      orgId?: string;
      workspaceId?: string;
    };

    const memory = getMemory();
    const baseUserId = userId.startsWith('CONV#') ? userId.split('#')[1] : userId;
    const scopeId = category === 'user_preference' ? `USER#${baseUserId}` : 'SYSTEM#GLOBAL';

    const perspectiveKeywords = content
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 4)
      .slice(0, 5);

    const metadata = {
      category,
      confidence: 10,
      impact: 5,
      complexity: 1,
      risk: 1,
      urgency: 1,
      priority: 5,
    };

    const finalTags = normalizeTags([...(tags ?? []), ...perspectiveKeywords]);

    await memory.addMemory(
      scopeId,
      category,
      content,
      {
        ...metadata,
        orgId,
        tags: finalTags,
      },
      { workspaceId }
    );
    return `Successfully saved knowledge as MEMORY:${category.toUpperCase()}${finalTags.length > 0 ? ` (Tags: ${finalTags.join(', ')})` : ''}: ${content}`;
  },
};

/**
 * Permanently deletes a specific memory item.
 */
export const pruneMemory = {
  ...memorySchema.pruneMemory,
  requiredPermissions: ['config:update'],
  execute: async (
    args: Record<string, unknown>,
    context?: { userId?: string }
  ): Promise<string> => {
    const { partitionKey, timestamp } = args as { partitionKey: string; timestamp: number };
    if (!partitionKey || !timestamp) return 'FAILED: Both partitionKey and timestamp are required.';

    if (context?.userId) {
      const { getIdentityManager, UserRole } = await import('../../../lib/session/identity');
      const identity = await getIdentityManager();
      const user = await identity.getUser(context.userId);

      if (!user || (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN)) {
        logger.warn(`Unauthorized pruneMemory attempt by ${context.userId} on ${partitionKey}`);
        return 'FAILED: Unauthorized. Only OWNER or ADMIN can prune memory.';
      }
    }

    try {
      const memory = getMemory();
      await memory.deleteItem({ userId: partitionKey, timestamp });
      logger.info(`Memory pruned by ${context?.userId ?? 'system'}: ${partitionKey}@${timestamp}`);
      return `Successfully pruned memory item: ${partitionKey}@${timestamp}`;
    } catch (error) {
      return `Failed to prune memory item: ${formatErrorMessage(error)}`;
    }
  },
};

/**
 * Adjusts priority, urgency, and impact scores of a memory item.
 */
export const prioritizeMemory = {
  ...memorySchema.prioritizeMemory,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const { userId, timestamp, priority, urgency, impact, workspaceId } = args as {
      userId: string;
      timestamp: number;
      priority?: number;
      urgency?: number;
      impact?: number;
      workspaceId?: string;
    };

    if (!userId || timestamp === undefined)
      return 'FAILED: Both userId and timestamp are required.';

    try {
      const memory = getMemory();
      const metadata: Record<string, number> = {};
      if (priority !== undefined) metadata.priority = priority;
      if (urgency !== undefined) metadata.urgency = urgency;
      if (impact !== undefined) metadata.impact = impact;

      if (Object.keys(metadata).length === 0) return 'FAILED: No update parameters provided.';

      await memory.updateInsightMetadata(userId, timestamp, metadata, { workspaceId });
      return `Successfully updated memory ${userId}@${timestamp}`;
    } catch (error) {
      return `Failed to prioritize memory: ${formatErrorMessage(error)}`;
    }
  },
};

/**
 * Updates or corrects an existing memory item.
 */
export const refineMemory = {
  ...memorySchema.refineMemory,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const { userId, timestamp, content, tags, priority, workspaceId } = args as {
      userId: string;
      timestamp: number;
      content?: string;
      tags?: string[];
      priority?: number;
      workspaceId?: string;
    };

    if (!userId || !timestamp) return 'FAILED: userId and timestamp are required.';

    try {
      const memory = getMemory();
      await memory.refineMemory(
        userId,
        timestamp,
        content,
        {
          tags,
          priority,
        },
        { workspaceId }
      );
      return `Successfully refined memory item: ${userId}@${timestamp}`;
    } catch (error) {
      return `Failed to refine memory: ${formatErrorMessage(error)}`;
    }
  },
};
