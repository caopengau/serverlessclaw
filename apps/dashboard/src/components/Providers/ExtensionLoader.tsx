'use client';

import { useEffect, useRef } from 'react';
import { useExtensions } from './ExtensionProvider';

/**
 * ExtensionLoader attempts to load domain-specific UI extensions.
 * It looks for a conventional entry point in the dashboard source.
 */
export function ExtensionLoader() {
  const { registerSidebarExtension, registerDynamicComponent } = useExtensions();
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;

    async function loadExtensions() {
      try {
        // Attempt to load from the conventional extension point
        const extension = await import('../../extensions');

        if (extension && typeof extension.init === 'function') {
          extension.init({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            registerSidebar: registerSidebarExtension as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            registerComponent: registerDynamicComponent as any,
          });
          console.log('[Dashboard] Domain extensions loaded successfully.');
        }
      } catch {
        // Silence errors - it just means no extensions are configured
        console.debug('[Dashboard] No extensions found.');
      }
    }

    loadExtensions();
    loaded.current = true;
  }, [registerSidebarExtension, registerDynamicComponent]);

  return null;
}
