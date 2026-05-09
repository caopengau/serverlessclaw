import { z } from 'zod';
import { IToolDefinition, ToolType } from '../../../lib/types/index';

export const gitSchema: Record<string, IToolDefinition> = {
  triggerTrunkSync: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    connectionProfile: [],
    connector_id: '',
    auth: { type: 'api_key', resource_id: '' },
    requiresApproval: true,
    requiredPermissions: ['admin'],
    name: 'triggerTrunkSync',
    description: 'Triggers a CI/CD job to sync with the origin main branch.',
    parameters: {
      type: 'object',
      properties: {
        commitMessage: { type: 'string', description: 'Commit message for the sync.' },
      },
      required: ['commitMessage'],
      additionalProperties: false,
    },
  },
  triggerSubtreePush: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    name: 'triggerSubtreePush',
    description:
      'Triggers a subtree push back to the Mother Hub (Source of Truth) for verified client contributions.',
    connectionProfile: ['codebuild', 'deployer'],
    requiresApproval: true,
    requiredPermissions: ['codebuild:StartBuild'],
    parameters: {
      type: 'object',
      properties: {
        commitMessage: { type: 'string', description: 'The message for the sync commit.' },
        prefix: { type: 'string', description: 'The subtree prefix (e.g., core/).' },
        hubUrl: { type: 'string', description: 'The target hub git URL.' },
        gapIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Gaps resolved by this contribution.',
        },
      },
      required: ['commitMessage', 'prefix', 'hubUrl'],
      additionalProperties: false,
    },
  },
};
