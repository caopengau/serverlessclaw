import { IToolDefinition } from '../../lib/types/tool';

/**
 * Proactive Scheduling Tools Definitions.
 * Allows agents to manage their own goal-oriented heartbeats.
 */
export const schedulerDefinitions: Record<string, IToolDefinition> = {
  /**
   * Proactively schedules a future task or recurring "wake-up" heartbeat.
   */
  scheduleGoal: {
    name: 'scheduleGoal',
    description:
      'Proactively schedules a future task or recurring "wake-up" heartbeat to achieve a goal.',
    parameters: {
      type: 'object',
      properties: {
        goalId: {
          type: 'string',
          description: 'Unique identifier for this goal/schedule (e.g., "audit-s3-permissions").',
        },
        task: {
          type: 'string',
          description: 'Description of the task to be performed when triggered.',
        },
        agentId: {
          type: 'string',
          description: 'The ID of the agent responsible for this goal (e.g., "planner", "coder").',
        },
        scheduleExpression: {
          type: 'string',
          description:
            'AWS Scheduler expression. Support: at(YYYY-MM-DDThh:mm:ss), rate(value unit), cron(fields). Example: "rate(1 hour)".',
        },
        metadata: {
          type: 'object',
          description: 'Optional metadata to be delivered with the heartbeat.',
        },
      },
      required: ['goalId', 'task', 'scheduleExpression', 'agentId', 'metadata'],
      additionalProperties: false,
    },
  },

  /**
   * Cancels and removes a previously scheduled proactive goal.
   */
  cancelGoal: {
    name: 'cancelGoal',
    description: 'Cancels and removes a previously scheduled proactive goal/heartbeat.',
    parameters: {
      type: 'object',
      properties: {
        goalId: { type: 'string', description: 'The unique ID of the goal to cancel.' },
      },
      required: ['goalId'],
      additionalProperties: false,
    },
  },

  /**
   * Lists all currently active proactive goals and scheduled heartbeats.
   */
  listGoals: {
    name: 'listGoals',
    description: 'Lists all currently active proactive goals and scheduled heartbeats.',
    parameters: {
      type: 'object',
      properties: {
        namePrefix: { type: 'string', description: 'Optional prefix to filter the goal list.' },
      },
      required: ['namePrefix'],
      additionalProperties: false,
    },
  },
};
