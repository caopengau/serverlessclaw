import { CodeBuildClient, StartBuildCommand } from '@aws-sdk/client-codebuild';
import { Resource } from 'sst';
import { toolDefinitions } from './definitions/index';
import { logger } from '../lib/logger';
import { SSTResource } from '../lib/types/system';
import { formatErrorMessage } from '../lib/utils/error';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const codebuild = new CodeBuildClient({});

/**
 * Reverts the last commit and re-triggers a deployment.
 */
export const TRIGGER_ROLLBACK = {
  ...toolDefinitions.triggerRollback,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const { reason } = args as { reason: string };
    const typedResource = Resource as unknown as SSTResource;
    try {
      logger.info(`ROLLBACK INITIATED: ${reason}`);
      await execAsync('git revert HEAD --no-edit');
      const command = new StartBuildCommand({
        projectName: typedResource.Deployer.name,
      });
      await codebuild.send(command);
      return `ROLLBACK_SUCCESSFUL: Last commit reverted and deployment re-triggered. Reason: ${reason}`;
    } catch (error) {
      return `ROLLBACK_FAILED: ${formatErrorMessage(error)}`;
    }
  },
};
