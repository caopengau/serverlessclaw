'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useExtensions } from '@/components/Providers/ExtensionProvider';

export default function ExtensionPage() {
  const params = useParams();
  const id = params.id as string;
  const { dynamicComponents } = useExtensions();

  const Component = dynamicComponents.get(id);

  if (!Component) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-2 text-zinc-400">
        <span className="text-lg font-semibold">Extension Page Not Loaded</span>
        <span className="text-sm text-zinc-500">
          Extension page &quot;{id}&quot; has not been registered.
        </span>
      </div>
    );
  }

  return <Component />;
}
