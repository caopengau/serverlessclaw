import { toolDefinitions } from './definitions';
import { SYSTEM_CONFIG_METADATA } from '../lib/metadata';

/**
 * Retrieves technical documentation, implications, and risks for all system configuration keys.
 */
export const getSystemConfigMetadata = {
  ...toolDefinitions.getSystemConfigMetadata,
  execute: async (): Promise<string> => {
    return JSON.stringify(SYSTEM_CONFIG_METADATA, null, 2);
  },
};
