import React from 'react';
import NerveCenterView from '@/components/Observability/NerveCenterView';
import PageHeader from '@/components/PageHeader';
import RoleGuard from '@/components/RoleGuard';
import { UserRole } from '@claw/core/lib/types/common';

export const dynamic = 'force-dynamic';

/**
 * Unified Observability Hub (Nerve Center)
 * Consolidates technical system states into a single tabbed dashboard.
 */
export default function ObservabilityHubPage() {
  return (
    <RoleGuard requiredRoles={[UserRole.ADMIN, UserRole.OWNER]}>
      <div className="flex-1 flex flex-col min-h-0 space-y-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-cyber-blue/5 via-transparent to-transparent">
        <PageHeader titleKey="OBSERVABILITY" subtitleKey="SYSPULSE_SUBTITLE" />

        <div className="flex-1 flex flex-col min-h-[600px] mb-10">
          <NerveCenterView />
        </div>
      </div>
    </RoleGuard>
  );
}
