import { PluginManager } from './plugin-manager';

function parseOptionalPluginModules(): string[] {
  const modules = process.env.CLAW_OPTIONAL_PLUGIN_MODULES;
  if (!modules) return [];

  return modules
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

async function registerPluginModule(modulePath: string) {
  const integrationModule = await import(modulePath);
  const pluginExport = Object.values(integrationModule).find(
    (candidate) =>
      typeof candidate === 'object' &&
      candidate !== null &&
      'id' in (candidate as Record<string, unknown>)
  );

  if (pluginExport) {
    await PluginManager.register(pluginExport as Parameters<typeof PluginManager.register>[0]);
  }
}

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

  for (const modulePath of parseOptionalPluginModules()) {
    try {
      await registerPluginModule(modulePath);
    } catch {
      // Ignore if optional integration module is not present in this build.
    }
  }
}
