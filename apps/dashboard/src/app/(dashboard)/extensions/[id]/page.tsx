'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useExtensions } from '@/components/Providers/ExtensionProvider';
import RoleGuard from '@/components/RoleGuard';

export default function ExtensionPage() {
  const params = useParams();
  const id = params.id as string;
  const { dynamicComponents, sidebarExtensions } = useExtensions();

  const ActiveComponent = dynamicComponents.get(id);

  if (!ActiveComponent) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-2 text-zinc-400">
        <span className="text-lg font-semibold">Extension Page Not Loaded</span>
        <span className="text-sm text-zinc-500">
          Extension page &quot;{id}&quot; has not been registered.
        </span>
      </div>
    );
  }

  // Dynamically resolve and enforce access control roles registered for the extension
  const extensionConfig = sidebarExtensions.find(
    (ext) => ext.id === id || ext.href === `/extensions/${id}`
  );

  const componentElement = React.createElement(ActiveComponent);

  if (extensionConfig?.requiredRoles && extensionConfig.requiredRoles.length > 0) {
    return <RoleGuard requiredRoles={extensionConfig.requiredRoles}>{componentElement}</RoleGuard>;
  }

  return componentElement;
}
