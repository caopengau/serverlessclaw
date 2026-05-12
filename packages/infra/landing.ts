import { SharedContext, getDomainConfig } from './shared';

/**
 * Deploys a Standalone Landing Page (Brand/Marketing site).
 * Strictly generic framework implementation.
 */
export function createLanding(
  ctx: SharedContext,
  options: {
    appPath: string;
    resourceName?: string;
    domainKey?: 'api' | 'dashboard' | 'router' | 'landing';
  }
): { landing: sst.aws.Nextjs } {
  const resourceName = options.resourceName ?? 'StandaloneHome';
  const domainKey = options.domainKey ?? 'landing';

  const dashboardDomain = process.env.CLAW_DOMAIN_DASHBOARD;
  const dashboardUrl = dashboardDomain ? `https://${dashboardDomain}` : 'http://localhost:7777';

  const landing = new sst.aws.Nextjs(resourceName, {
    path: options.appPath,
    domain: getDomainConfig(domainKey),
    environment: {
      NEXT_PUBLIC_DASHBOARD_URL: dashboardUrl,
    },
  });

  return { landing };
}
