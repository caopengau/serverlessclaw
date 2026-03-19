import { toolDefinitions } from './definitions';
import { logger } from '../lib/logger';
import { rewardDeployLimit } from '../lib/deploy-stats';
import { formatErrorMessage } from '../lib/utils/error';

/**
 * Checks system health at a given URL and rewards deployment limits on success.
 */
export const CHECK_HEALTH = {
  ...toolDefinitions.checkHealth,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const { url } = args as { url: string };
    try {
      logger.info(`Checking health at ${url}`);
      const response = await fetch(url as string);
      if (response.ok) {
        await rewardDeployLimit();
        return `HEALTH_OK: System is responsive. Deployment limit rewarded (-1).`;
      }
      return `HEALTH_FAILED: Received status ${response.status}.`;
    } catch (error) {
      return `HEALTH_ERROR: ${formatErrorMessage(error)}`;
    }
  },
};
