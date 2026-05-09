import { PluginManager } from './plugin-manager';

/**
 * Hub for all internal monorepo plugins.
 * Projects like 'product' or specialized integrations can register their
 * capabilities here.
 */
export async function initializePlugins() {
  await PluginManager.initialize();

  // Example: Manual registration of an internal project's capabilities
  // In a real monorepo setup, you might use dynamic imports or
  // generated code to avoid circular dependencies.

  /*
  try {
    const { productPlugin } = await import('../../integrations/product/plugin');
    await PluginManager.register(productPlugin);
  } catch (e) {
    // Ignore if project is not present in this build
  }
  */

  try {
    const { githubPlugin } = await import('../../integration-github/plugin');
    await PluginManager.register(githubPlugin);
  } catch {
    // Ignore if github integration is not present
  }
}
