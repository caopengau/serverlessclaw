import { CodeBuildClient, StartBuildCommand } from '@aws-sdk/client-codebuild';
import { Resource } from 'sst';
import { gitTools } from './definitions/git';
import { logger } from '../lib/logger';
import { formatErrorMessage } from '../lib/utils/error';

const codebuild = new CodeBuildClient({});

interface ToolsResource {
  Deployer: { name: string };
}

/**
 * Triggers a CodeBuild job specifically to sync the repository back to Git.
 * This is called after QA verification passes.
 */
export const GIT_SYNC = {
  ...gitTools.gitSync,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    try {
      const { commitMessage = 'chore: autonomous improvement [skip ci]' } = args as {
        commitMessage?: string;
      };

      const typedResource = Resource as unknown as ToolsResource;

      logger.info('Triggering Git Sync via CodeBuild (SYNC_ONLY=true)...');

      const command = new StartBuildCommand({
        projectName: typedResource.Deployer.name,
        environmentVariablesOverride: [
          {
            name: 'SYNC_ONLY',
            value: 'true',
            type: 'PLAINTEXT',
          },
          {
            name: 'COMMIT_MESSAGE',
            value: commitMessage,
            type: 'PLAINTEXT',
          },
        ],
      });

      const response = await codebuild.send(command);
      const buildId = response.build?.id;

      return `Git Sync triggered successfully. Build ID: ${buildId}. The changes will be pushed to the remote repository shortly.`;
    } catch (error) {
      return `Failed to trigger Git Sync: ${formatErrorMessage(error)}`;
    }
  },
};
