'use client';

import React from 'react';
import OperationCard from './OperationCard';
import { DynamicComponent } from '../Chat/types';

interface RegistryProps {
  component: DynamicComponent;
  onAction?: (actionId: string, payload?: unknown) => void;
}

/**
 * Registry of dynamic components that can be rendered in the chat.
 */
export function DynamicComponentRegistry({ component, onAction }: RegistryProps) {
  switch (component.componentType) {
    case 'operation-card':
    case 'action-card':
      return <OperationCard component={component} onAction={onAction} />;
    
    // Placeholder for future components
    case 'deployment-stepper':
      return (
        <div className="p-4 border border-dashed border-white/20 rounded text-[10px] text-white/40 italic">
          Deployment Stepper (Phase 4)
        </div>
      );
    
    default:
      return (
        <div className="p-4 border border-dashed border-red-500/20 rounded text-[10px] text-red-500/60 italic">
          Unknown Component: {component.componentType}
        </div>
      );
  }
}
