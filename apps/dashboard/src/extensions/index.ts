import { Server } from 'lucide-react';
import { UserRole } from '@claw/core/lib/types/common';

/**
 * Domain Extensions
 *
 * This file registers domain-specific UI elements into the generic
 * ServerlessClaw dashboard.
 */
export function init({
  registerSidebar,
  registerComponent,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerSidebar: (ext: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerComponent: (ext: any) => void;
}) {
  // 1. Register the Devices Fleet Management page
  registerSidebar({
    id: 'nexus-devices',
    label: 'DEVICES',
    subtitle: 'DEVICES_SUBTITLE',
    href: '/devices',
    icon: Server,
    section: 'OPERATIONS',
    requiredRoles: [UserRole.ADMIN, UserRole.OWNER, UserRole.MEMBER],
  });

  console.log('[Domain-Extension] Registered energy asset management modules.');
}
