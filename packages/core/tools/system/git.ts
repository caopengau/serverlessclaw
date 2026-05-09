import { CodeBuildClient, StartBuildCommand } from '@aws-sdk/client-codebuild';
import { Resource } from 'sst';
import { gitSchema } from './definitions/git';
import { logger } from '../../lib/logger';
import { formatErrorMessage } from '../../lib/utils/error';

const codebuild = new CodeBuildClient({});

/**
 * Triggers a CI/CD job to sync with the origin main branch.
 */
export const triggerTrunkSync = {
  ...gitSchema.triggerTrunkSync,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    try {
      const { commitMessage, gapIds, traceId } = args as {
        commitMessage: string;
        gapIds?: string[];
        traceId?: string;
      };
      const buildProject =
        (Resource as unknown as Record<string, { name?: string }>).DeployProject?.name ||
        (Resource as unknown as Record<string, { name?: string }>).Deployer?.name;

      if (!buildProject) return 'FAILED: Deploy project not linked.';

      logger.info(`Triggering Trunk Sync via CodeBuild: ${commitMessage}`);

      const envVars = [
        { name: 'SYNC_ONLY', value: 'true' },
        { name: 'COMMIT_MESSAGE', value: commitMessage },
      ];

      if (gapIds && gapIds.length > 0) {
        envVars.push({ name: 'GAP_IDS', value: JSON.stringify(gapIds) });
      }
      if (traceId) {
        envVars.push({ name: 'TRACE_ID', value: traceId });
      }

      const command = new StartBuildCommand({
        projectName: buildProject,
        environmentVariablesOverride: envVars,
      });

      const response = await codebuild.send(command);
      return `Trunk Sync triggered successfully. Build ID: ${response.build?.id}. Gaps: ${gapIds?.join(', ') || 'none'}`;
    } catch (error) {
      return `Failed to trigger Trunk Sync: ${formatErrorMessage(error)}`;
    }
  },
};

/**
 * Triggers an atomic subtree push back to the Mother Hub for verified contributions.
 */
export const triggerSubtreePush = {
  ...gitSchema.triggerSubtreePush,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    try {
      const { commitMessage, prefix, hubUrl, gapIds } = args as {
        commitMessage: string;
        prefix: string;
        hubUrl: string;
        gapIds?: string[];
      };

      const buildProject =
        (Resource as unknown as Record<string, { name?: string }>).DeployProject?.name ||
        (Resource as unknown as Record<string, { name?: string }>).Deployer?.name;

      if (!buildProject) return 'FAILED: Deploy project not linked.';

      logger.info(`Triggering Subtree Push to Hub: ${hubUrl}`);

      const envVars = [
        { name: 'SYNC_ONLY', value: 'true' },
        { name: 'SYNC_MODE', value: 'push' },
        { name: 'SUBTREE_PREFIX', value: prefix },
        { name: 'HUB_URL', value: hubUrl },
        { name: 'COMMIT_MESSAGE', value: commitMessage },
      ];

      if (gapIds && gapIds.length > 0) {
        envVars.push({ name: 'GAP_IDS', value: JSON.stringify(gapIds) });
      }

      const command = new StartBuildCommand({
        projectName: buildProject,
        environmentVariablesOverride: envVars,
      });

      const response = await codebuild.send(command);
      return `Subtree push triggered successfully. Build ID: ${response.build?.id}. Prefix: ${prefix}`;
    } catch (error) {
      return `Failed to trigger subtree push: ${formatErrorMessage(error)}`;
    }
  },
};
