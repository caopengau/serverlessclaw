/**
 * ServerlessClaw Dashboard Extensions
 * This file is the bridge between the framework and hub-specific extensions.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function init(registry: any) {
  try {
    /**
     * Standardized hub extension entry point.
     * The /src/extensions/hub folder is a generic hook for project-specific UI logic.
     */
    const { init: hubInit } = await import('./hub');
    if (typeof hubInit === 'function') {
      hubInit(registry);
    }
  } catch {
    // No hub extensions present or failed to load, skip gracefully
  }
}
