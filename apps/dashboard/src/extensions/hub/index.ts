/**
 * Generic Extension Hub
 *
 * Products can register sidebar items and components here.
 */

export function init(hubConfig: {
  registerSidebarHook: (config: unknown) => void;
  registerComponentHook: (config: unknown) => void;
}) {
  // Generic hub initialization.
  console.debug('[Hub] Extension hub ready.', hubConfig);
}
