import { IToolDefinition } from '../../lib/types/index';

/**
 * Deployment-related tool definitions.
 */
export const deploymentTools: Record<string, IToolDefinition> = {
  stageChanges: {
    name: 'stageChanges',
    description:
      'Compresses modified files into a ZIP and uploads to the S3 staging bucket for CodeBuild. Enforces the "Definition of Done" (DoD): logic changes MUST be accompanied by tests and documentation. Requires recent successful validateCode and runTests in the session.',
    parameters: {
      type: 'object',
      properties: {
        modifiedFiles: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of relative file paths that were modified.',
        },
        sessionId: {
          type: 'string',
          description: 'Current session ID to verify pre-flight validation history.',
        },
        skipValidation: {
          type: 'boolean',
          description: 'Internal use only: skip session history verification.',
        },
      },
      required: ['modifiedFiles', 'sessionId', 'skipValidation'],
      additionalProperties: false,
    },
    connectionProfile: ['storage'],
  },
  triggerDeployment: {
    name: 'triggerDeployment',
    description: 'Triggers an autonomous self-deployment of the agent infrastructure.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'The reason for the deployment (e.g., added a new tool).',
        },
        gapIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of gap IDs to associate with this build.',
        },
      },
      required: ['reason', 'gapIds'],
      additionalProperties: false,
    },
    connectionProfile: ['codebuild'],
  },
  validateCode: {
    name: 'validateCode',
    description: 'Runs type checking and linting to ensure no regressions are introduced.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  checkHealth: {
    name: 'checkHealth',
    description: 'Verify the health of the deployed agent API.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The health check endpoint URL.' },
      },
      required: ['url'],
      additionalProperties: false,
    },
  },
  triggerRollback: {
    name: 'triggerRollback',
    description: 'Trigger an emergency rollback by reverting the last commit and redeploying.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'The reason for the rollback.' },
      },
      required: ['reason'],
      additionalProperties: false,
    },
    connectionProfile: ['codebuild'],
  },
  runTests: {
    name: 'runTests',
    description: 'Runs the project unit tests to verify changes before staging.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  triggerInfraRebuild: {
    name: 'triggerInfraRebuild',
    description:
      'Triggers a full infrastructure rebuild via CodeBuild. Use when sst.config.ts or infra/ files have changed.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'The reason for triggering the rebuild.',
        },
      },
      required: ['reason'],
      additionalProperties: false,
    },
    requiresApproval: true,
    connectionProfile: ['codebuild'],
  },
};
