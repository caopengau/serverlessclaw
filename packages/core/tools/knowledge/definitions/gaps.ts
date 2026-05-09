import { z } from 'zod';
import { IToolDefinition, ToolType } from '../../../lib/types/index';

export const gapSchema: Record<string, IToolDefinition> = {
  reportGap: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    requiresApproval: false,
    requiredPermissions: [],
    name: 'reportGap',
    description: 'Records a new capability gap or system limitation into the evolution pipeline.',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'Detailed description of the gap or missing capability.',
        },
        impact: {
          type: 'number',
          description: 'Impact score (1-10) of this gap on system utility.',
        },
        urgency: {
          type: 'number',
          description: 'Urgency score (1-10) for addressing this gap.',
        },
        category: {
          type: 'string',
          enum: [
            'strategic_gap',
            'tactical_lesson',
            'system_knowledge',
            'architecture',
            'security',
          ],
          description: 'The category of the insight.',
        },
      },
      required: ['content', 'impact', 'urgency', 'category'],
      additionalProperties: false,
    },
    connectionProfile: ['config'],
  },
  manageGap: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    requiresApproval: false,
    requiredPermissions: [],
    name: 'manageGap',
    description: 'Updates or lists capability gaps in the system.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['update', 'list'],
          description: 'The action to perform: "update" (default) or "list".',
        },
        gapId: { type: 'string', description: 'The ID of the gap (required for "update").' },
        status: {
          type: 'string',
          enum: ['OPEN', 'PLANNED', 'PROGRESS', 'DEPLOYED', 'DONE', 'FAILED', 'ARCHIVED'],
          description: 'The new status for the gap (required for "update").',
        },
      },
      required: [],
      additionalProperties: false,
    },
    connectionProfile: ['config'],
  },
};
