/**
 * Dashboard Extension Bridge
 *
 * This file serves as the integration point between the generic
 * ServerlessClaw dashboard and domain-specific product extensions.
 */

import { GoldExPlugin } from '@goldex/core';
import { PluginManager } from '@claw/core/lib/plugin-manager';

interface ExtensionHooks {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerSidebar: (ext: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerComponent: (ext: any) => void;
}

export function init({ registerSidebar, registerComponent }: ExtensionHooks) {
  // Register the GoldEx plugin with the Framework's PluginManager
  PluginManager.register(GoldExPlugin).catch(err => {
    console.error('[GoldEx] Failed to register plugin:', err);
  });

  // Register sidebar extensions from the plugin
  if (GoldExPlugin.sidebarExtensions) {
    GoldExPlugin.sidebarExtensions.forEach(ext => {
      registerSidebar(ext);
    });
  }

  console.debug('[GoldEx] Extension bridge initialized with GoldExPlugin.');
}
