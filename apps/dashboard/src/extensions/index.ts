/**
 * Dashboard Extension Bridge (Generic OSS Template)
 *
 * This file serves as a placeholder for domain-specific product extensions.
 * In production environments, this file remains empty, or is dynamically overridden
 * via webpack resolve aliases using custom workspace paths.
 */

interface ExtensionHooks {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerSidebar: (ext: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerComponent: (ext: any) => void;
}

export function init({ registerSidebar: _registerSidebar, registerComponent: _registerComponent }: ExtensionHooks) {
  // No-op for generic OSS framework
  console.debug('[ServerlessClaw] Generic extension bridge initialized (no-op).');
}
