/**
 * Extension Hub Template
 * 
 * Includes both landing page and dashboard extension components.
 * The framework dashboard build process copies these exports into
 * the extensions/hub directory at build time from the target product.
 */
export { LandingPage } from './components/landing/LandingPage';

/**
 * Product Dashboard Extension Initializer
 */
export function init({ registerSidebar, registerComponent }: any) {
  // Products can register their own sidebar items and components here
}
