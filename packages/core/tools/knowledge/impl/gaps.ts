import { gapSchema } from '../definitions/gaps';
import { GapStatus, EventType } from '../../../lib/types/agent';
import { InsightCategory } from '../../../lib/types/memory';
import { emitEvent } from '../../../lib/utils/bus';
import { formatErrorMessage } from '../../../lib/utils/error';
import { logger } from '../../../lib/logger';

import { getMemory } from '../utils';

/**
 * Updates or lists capability gaps in the system.
 */
export const manageGap = {
  ...gapSchema.manageGap,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const {
      gapId,
      status,
      action = 'update',
      workspaceId,
    } = args as {
      gapId?: string;
      status?: GapStatus;
      action?: 'update' | 'list';
      workspaceId?: string;
    };

    try {
      const memory = getMemory();

      if (action === 'list') {
        const gaps = await memory.getAllGaps(GapStatus.OPEN, { workspaceId });
        if (gaps.length === 0) return 'No open capability gaps found.';

        const sortedGaps = [...gaps].sort(
          (a, b) => (b.metadata.impact || 0) - (a.metadata.impact || 0)
        );

        return (
          `Found ${gaps.length} open capability gaps:\n` +
          sortedGaps
            .map(
              (g) =>
                `- [${g.id}] (Impact: ${g.metadata.impact}/10, Urgency: ${g.metadata.urgency}/10) ${g.content}`
            )
            .join('\n')
        );
      }

      if (!gapId || !status) {
        return 'FAILED: gapId and status are required for "update" action.';
      }

      await memory.updateGapStatus(gapId, status, { workspaceId });
      return `Successfully updated gap ${gapId} to ${status}`;
    } catch (error) {
      return `Failed to ${action} gap: ${formatErrorMessage(error)}`;
    }
  },
};

/**
 * Records a new capability gap or system limitation.
 */
export const reportGap = {
  ...gapSchema.reportGap,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const { content, impact, urgency, category, sessionId, userId, workspaceId } = args as {
      content: string;
      impact?: number;
      urgency?: number;
      category?: InsightCategory;
      sessionId?: string;
      userId: string;
      workspaceId?: string;
    };

    try {
      const metadata = {
        category: category ?? InsightCategory.STRATEGIC_GAP,
        confidence: 9,
        impact: impact ?? 5,
        complexity: 5,
        risk: 5,
        urgency: urgency ?? 5,
        priority: 5,
      };

      const gapIdTimestamp = await getMemory().addMemory(
        'SYSTEM#GLOBAL',
        category ?? InsightCategory.STRATEGIC_GAP,
        content,
        metadata,
        { workspaceId }
      );
      const gapId = gapIdTimestamp.toString();

      await emitEvent('agent.tool', EventType.EVOLUTION_PLAN, {
        gapId,
        details: content,
        metadata,
        contextUserId: userId,
        sessionId,
      });

      return `Successfully recorded new gap: [${gapId}] ${content}`;
    } catch (error) {
      logger.error('Failed to report gap:', error);
      return `Failed to report gap: ${formatErrorMessage(error)}`;
    }
  },
};
