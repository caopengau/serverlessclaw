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
    domainKey?: string;
  }
): { landing: sst.aws.Nextjs } {
  const resourceName = options.resourceName ?? 'StandaloneHome';
  const domainKey = options.domainKey ?? 'landing';

  const landing = new sst.aws.Nextjs(resourceName, {
    path: options.appPath,
    domain: getDomainConfig(domainKey),
    environment: {
      DASHBOARD_URL: 'http://localhost:7777', // Default for local dev
    },
  });

  return { landing };
}
