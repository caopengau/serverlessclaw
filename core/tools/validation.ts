import { toolDefinitions } from './definitions';
import { logger } from '../lib/logger';
import { formatErrorMessage } from '../lib/utils/error';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Validates the current codebase using type checking and linting.
 */
export const validateCode = {
  ...toolDefinitions.validateCode,
  execute: async (): Promise<string> => {
    try {
      logger.info('Running pre-flight validation...');
      const { stdout: tscOut } = await execAsync('npx tsc --noEmit');
      const { stdout: lintOut } = await execAsync('npx eslint . --fix-dry-run');
      return `Validation Successful:\n${tscOut}\n${lintOut}`;
    } catch (error) {
      return `Validation FAILED:\n${formatErrorMessage(error)}`;
    }
  },
};
