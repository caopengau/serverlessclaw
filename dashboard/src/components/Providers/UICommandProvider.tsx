'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner'; // Assuming sonner is used or can be added

interface UICommandDetail {
  action: 'open_modal' | 'close_modal' | 'focus_resource' | 'toggle_sidebar';
  target: string;
  payload?: any;
}

interface UICommandContextType {
  activeModal: string | null;
  setActiveModal: (id: string | null) => void;
  lastCommand: UICommandDetail | null;
}

const UICommandContext = createContext<UICommandContextType | undefined>(undefined);

/**
 * Provider that listens for global 'claw:ui-command' events and manages UI state.
 */
export function UICommandProvider({ children }: { children: React.ReactNode }) {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [lastCommand, setLastCommand] = useState<UICommandDetail | null>(null);

  useEffect(() => {
    const handleCommand = (event: any) => {
      const detail = event.detail as UICommandDetail;
      setLastCommand(detail);
      console.log(`[UICommandProvider] Executing command:`, detail);

      switch (detail.action) {
        case 'open_modal':
          setActiveModal(detail.target);
          break;
        case 'close_modal':
          if (activeModal === detail.target) setActiveModal(null);
          break;
        case 'focus_resource':
          // Can be handled by specific views listening to lastCommand
          toast(`Focusing resource: ${detail.target}`);
          break;
        case 'toggle_sidebar':
          // Handle logic to toggle sidebar
          break;
      }
    };

    window.addEventListener('claw:ui-command', handleCommand);
    return () => window.removeEventListener('claw:ui-command', handleCommand);
  }, [activeModal]);

  return (
    <UICommandContext.Provider value={{ activeModal, setActiveModal, lastCommand }}>
      {children}
    </UICommandContext.Provider>
  );
}

export const useUICommand = () => {
  const context = useContext(UICommandContext);
  if (!context) throw new Error('useUICommand must be used within a UICommandProvider');
  return context;
};
