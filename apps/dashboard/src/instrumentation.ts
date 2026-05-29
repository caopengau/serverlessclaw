import { logger } from '@claw/core/lib/logger';
import { PluginManager } from '@claw/core/lib/plugin-manager';

export async function register() {
  // Only run on server side
  if (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_RUNTIME === 'edge') {
    logger.info('[Dashboard] Initializing server-side extensions...');

    // 1. Initialize core PluginManager
    await PluginManager.initialize();

    // 2. Load active project-specific extensions if configured
    if (process.env.NEXT_PUBLIC_ACTIVE_EXTENSIONS) {
      try {
        // Attempt to load the active extension's server-side initialization
        // We use the same 'active' bridge but for server-side
        const activeExt = await import('./extensions/active');
        if (activeExt && typeof activeExt.initServer === 'function') {
          await activeExt.initServer();
          logger.info('[Dashboard] Project-specific server extensions initialized.');
        }
      } catch (_err) {
        logger.debug('[Dashboard] No server-side initialization found for active extension.');
      }
    }
  }
}
