import { z } from 'zod';
import { IToolDefinition, ToolType } from '../../../lib/types/index';

export const workflowSchema: Record<string, IToolDefinition> = {
  pauseWorkflow: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    connectionProfile: [],
    connector_id: '',
    auth: { type: 'api_key', resource_id: '' },
    requiresApproval: false,
    requiredPermissions: [],
    name: 'pauseWorkflow',
    description:
      'Suspends the current agent workflow and saves its state to DynamoDB for later resumption. Useful for long-running tasks or tasks requiring human approval.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description:
            'The reason for pausing the workflow (e.g., "Waiting for human approval", "Long-running deployment").',
        },
        metadata: { type: 'object', description: 'Optional metadata to store with the snapshot.' },
      },
      required: ['reason'],
      additionalProperties: false,
    },
  },
  resumeWorkflow: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    connectionProfile: [],
    connector_id: '',
    auth: { type: 'api_key', resource_id: '' },
    requiresApproval: true,
    requiredPermissions: ['admin'],
    name: 'resumeWorkflow',
    description: 'Resumes a previously paused workflow from its saved state.',
    parameters: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'The unique ID of the session to resume.' },
      },
      required: ['sessionId'],
      additionalProperties: false,
    },
  },
};
