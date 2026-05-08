import GridStatus from './components/GridStatus';
import { Activity } from 'lucide-react';

/**
 * Voltx UI Extension Exports
 *
 * Includes both landing page and dashboard extension components.
 * The framework dashboard build process copies these exports into
 * the extensions/hub directory at build time.
 */
export { LandingPage } from './components/landing/LandingPage';

/**
 * VoltX Dashboard Extension Initializer
 */
export function init({ registerSidebar, registerComponent }: any) {
  // 1. Register Energy Sidebar Item
  registerSidebar({
    id: 'voltx-grid',
    label: 'Energy Grid',
    subtitle: 'Real-time VPP performance',
    href: '/voltx/grid',
    icon: Activity,
    section: 'OPERATIONS',
  });

  // 2. Register Energy Chat Components
  registerComponent({
    type: 'voltx-grid-status',
    component: GridStatus,
  });
}
