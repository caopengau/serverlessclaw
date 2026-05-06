'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

export interface TenantInfo {
  id: string;
  name: string;
  orgId?: string;
  teamId?: string;
}

export interface TenantContextType {
  activeWorkspaceId: string | null;
  activeOrgId: string | null;
  activeTeamId: string | null;
  setActiveWorkspace: (id: string | null) => void;
  tenantInfo: TenantInfo | null;
  workspaces: TenantInfo[];
  isLoading: boolean;
  refreshWorkspaces: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

/**
 * Provider for managing global tenant context (Workspace/Org/Team).
 * Enables Enterprise Scale isolation across the dashboard.
 */
export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('claw_active_workspace');
    }
    return null;
  });
  const [workspaces, setWorkspaces] = useState<TenantInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch('/api/workspaces');
      const data = await res.json();
      setWorkspaces(data.workspaces || []);
    } catch (e) {
      console.error('Failed to fetch workspaces:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch list on mount
  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const setActiveWorkspace = useCallback((id: string | null) => {
    setActiveWorkspaceId(id);
    if (id) {
      localStorage.setItem('claw_active_workspace', id);
    } else {
      localStorage.removeItem('claw_active_workspace');
    }
  }, []);

  // Update detailed tenant info when selection or list changes
  const tenantInfo = useMemo(() => {
    if (activeWorkspaceId && workspaces.length > 0) {
      return workspaces.find((w) => w.id === activeWorkspaceId) || null;
    }
    return null;
  }, [activeWorkspaceId, workspaces]);

  const value = useMemo(
    () => ({
      activeWorkspaceId,
      activeOrgId: tenantInfo?.orgId || null,
      activeTeamId: tenantInfo?.teamId || null,
      setActiveWorkspace,
      tenantInfo,
      workspaces,
      isLoading,
      refreshWorkspaces: fetchWorkspaces,
    }),
    [activeWorkspaceId, tenantInfo, workspaces, isLoading, setActiveWorkspace, fetchWorkspaces]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

/**
 * Hook to access and manage the current tenant context.
 */
export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
