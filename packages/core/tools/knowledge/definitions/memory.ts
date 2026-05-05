import { z } from 'zod';
import { IToolDefinition, ToolType } from '../../../lib/types/index';

export const memorySchema: Record<string, IToolDefinition> = {
  recallKnowledge: {
    type: ToolType.FUNCTION,
    requiresApproval: false,
    requiredPermissions: [],
    name: 'recallKnowledge',
    description:
      "Searches the agent's long-term memory for relevant facts, lessons, or capability gaps.",
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query or keyword (use "*" for all recent).',
        },
        category: {
          type: 'string',
          enum: [
            'user_preference',
            'tactical_lesson',
            'strategic_gap',
            'system_knowledge',
            'architecture',
            'security',
          ],
          description: 'Optional category filter.',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags to filter the search.',
        },
        minImpact: {
          type: 'number',
          description: 'Minimum impact score (0-10) filter.',
        },
        minConfidence: {
          type: 'number',
          description: 'Minimum confidence score (0-10) filter.',
        },
        orgId: {
          type: 'string',
          description: 'Optional organization ID to scope the search.',
        },
      },
      required: ['query', 'category'],
      additionalProperties: false,
    },
    argSchema: z.object({
      query: z.string(),
      category: z.enum([
        'user_preference',
        'tactical_lesson',
        'strategic_gap',
        'system_knowledge',
        'architecture',
        'security',
      ]),
      tags: z.array(z.string()).optional(),
      minImpact: z.number().optional(),
      minConfidence: z.number().optional(),
      userId: z.string(),
      orgId: z.string().optional(),
    }),
    connectionProfile: ['memory'],
  },
  saveMemory: {
    type: ToolType.FUNCTION,
    requiresApproval: false,
    requiredPermissions: [],
    name: 'saveMemory',
    description:
      'Saves project knowledge (facts, conclusions, user preferences) into the system memory.',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The knowledge, fact, or preference to save.' },
        category: {
          type: 'string',
          enum: [
            'user_preference',
            'system_knowledge',
            'tactical_lesson',
            'architecture',
            'security',
          ],
          description: 'The category of the knowledge.',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags for the memory.',
        },
        orgId: {
          type: 'string',
          description: 'Optional organization ID to scope the knowledge.',
        },
      },
      required: ['content', 'category'],
      additionalProperties: false,
    },
    argSchema: z.object({
      content: z.string(),
      category: z.enum([
        'user_preference',
        'system_knowledge',
        'tactical_lesson',
        'architecture',
        'security',
      ]),
      tags: z.array(z.string()).optional(),
      userId: z.string(),
      orgId: z.string().optional(),
    }),
    connectionProfile: ['memory'],
  },
  pruneMemory: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    requiresApproval: false,
    requiredPermissions: [],
    name: 'pruneMemory',
    description:
      'Permanently deletes a specific memory item from the neural reserve. Use this to remove stale, incorrect, or redundant information.',
    parameters: {
      type: 'object',
      properties: {
        partitionKey: {
          type: 'string',
          description:
            'The full partition key (ID) of the memory item (e.g., "USER#123", "LESSON#456").',
        },
        timestamp: {
          type: 'number',
          description: 'The exact timestamp (sort key) of the memory item.',
        },
      },
      required: ['partitionKey', 'timestamp'],
      additionalProperties: false,
    },
    connectionProfile: ['memory'],
  },
  prioritizeMemory: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    name: 'prioritizeMemory',
    description: 'Adjusts priority, urgency, and impact scores of a memory item.',
    parameters: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The partition key (e.g. USER#id).' },
        timestamp: { type: 'number', description: 'The sort key.' },
        priority: { type: 'number', description: 'New priority score (1-10).' },
        urgency: { type: 'number', description: 'New urgency score (1-10).' },
        impact: { type: 'number', description: 'New impact score (1-10).' },
      },
      required: ['userId', 'timestamp'],
      additionalProperties: false,
    },
    connectionProfile: ['memory'],
  },
  refineMemory: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    name: 'refineMemory',
    description: 'Updates or corrects an existing memory item.',
    parameters: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The partition key.' },
        timestamp: { type: 'number', description: 'The sort key.' },
        content: { type: 'string', description: 'The updated content.' },
        tags: { type: 'array', items: { type: 'string' } },
        priority: { type: 'number' },
      },
      required: ['userId', 'timestamp'],
      additionalProperties: false,
    },
    connectionProfile: ['memory'],
  },
  deleteTraces: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    name: 'deleteTraces',
    description: 'Deletes execution traces from the system. Use "all" to purge everything.',
    parameters: {
      type: 'object',
      properties: {
        traceId: { type: 'string', description: 'The trace ID to delete, or "all".' },
      },
      required: ['traceId'],
      additionalProperties: false,
    },
    connectionProfile: ['storage'],
  },
  forceReleaseLock: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    name: 'forceReleaseLock',
    description: 'Force-releases a distributed lock by deleting it from memory.',
    parameters: {
      type: 'object',
      properties: {
        lockId: { type: 'string', description: 'The lock ID (must start with LOCK#).' },
      },
      required: ['lockId'],
      additionalProperties: false,
    },
    connectionProfile: ['memory'],
  },
};
