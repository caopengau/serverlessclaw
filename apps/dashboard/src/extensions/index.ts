/**
 * Dashboard Extension Bridge
 *
 * This file serves as the integration point between the generic
 * ServerlessClaw dashboard and domain-specific product extensions.
 *
 * To add product-specific UI (sidebar links, components, etc.),
 * implement the init() function below.
 *
 * Note: In production builds, this file should remain generic.
 * Domain-specific logic should be injected via dependencies or
 * build-time configuration.
 */

interface ExtensionHooks {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerSidebar: (ext: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerComponent: (ext: any) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function init({ registerSidebar, registerComponent }: ExtensionHooks) {
  // Generic OSS implementation is empty.
  // Product-specific logic (e.g. Spoke) should be registered here
  // by importing from domain packages.

  console.debug('[Framework] Extension bridge initialized (Generic).');
}
