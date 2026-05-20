/**
 * Generic Extension Hub
 *
 * Products can register sidebar items and components here.
 */

export function init(hubConfig: {
  registerSidebar: (config: unknown) => void;
  registerComponent: (config: unknown) => void;
}) {
  // Generic hub initialization.
  console.debug('[Hub] Extension hub ready.', hubConfig);
}
