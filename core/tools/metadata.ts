import { toolDefinitions } from './definitions/index';
import { SYSTEM_CONFIG_METADATA } from '../lib/metadata';

/**
 * Retrieves technical documentation, implications, and risks for all system configuration keys.
 */
export const GET_SYSTEM_CONFIG_METADATA = {
  ...toolDefinitions.getSystemConfigMetadata,
  execute: async (): Promise<string> => {
    return JSON.stringify(SYSTEM_CONFIG_METADATA, null, 2);
  },
};
