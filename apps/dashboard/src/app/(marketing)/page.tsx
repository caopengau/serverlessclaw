'use client';

import { useEffect, useState } from 'react';

/**
 * Landing Page with Extension Support
 *
 * Dynamically loads a custom landing page from the hub extension if available.
 * Falls back to generic landing page if no custom implementation exists.
 *
 * Products can provide a custom landing page by exporting from their hub extension:
 *   export { LandingPage } from '@product-ui/components/landing';
 */

export default function LandingPage() {
  const [Component, setComponent] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        // Try to load custom landing page from hub extension
        const hub = await import('@/extensions/hub/index');
        if (hub.LandingPage) {
          setComponent(() => hub.LandingPage);
        }
      } catch (err) {
        console.error('[Landing] Failed to load custom landing page:', err);
      }
    })();
  }, []);

  if (!Component) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Loading...</h1>
        </div>
      </div>
    );
  }

  return <Component />;
}
