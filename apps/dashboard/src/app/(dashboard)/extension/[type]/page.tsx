'use client';
/* eslint-disable react-hooks/static-components */

import React, { Suspense, use } from 'react';
import { useExtensions } from '../../../../components/Providers/ExtensionProvider';

/**
 * Generic Extension Host
 *
 * This page renders a dynamic component based on the 'type' parameter.
 * It allows domain-specific plugins to inject entire pages into the dashboard.
 */
interface ExtensionPageProps {
  params: Promise<{ type: string }>;
}

export default function ExtensionHostPage({ params }: ExtensionPageProps) {
  const { type } = use(params);
  const { dynamicComponents } = useExtensions();

  // Retrieve the component from the central extension registry
  const Component = dynamicComponents.get(type);

  if (!Component) {
    return (
      <div className="flex-1 p-8 text-white/30 italic font-mono text-sm border border-dashed border-white/5 m-8 rounded-lg bg-white/5">
        &gt; EXTENSION_COMPONENT_NOT_FOUND: {type}
        <div className="mt-2 text-[10px] opacity-40">
          Check if the component is registered in the Spoke&apos;s extensions/index.ts
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full">
      <Suspense
        fallback={
          <div className="p-8 text-white/20 font-mono animate-pulse">Initializing extension...</div>
        }
      >
        <Component component={{ type }} />
      </Suspense>
    </div>
  );
}
