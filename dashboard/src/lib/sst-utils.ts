import { Resource } from 'sst';

/**
 * Safely gets a Resource property, with fallback to environment variables.
 * This ensures the dashboard remains functional even if SST links are not active
 * (e.g., during some local development scenarios or CI).
 */
export function getResourceUrl(resourceName: string, prop: string = 'url'): string | undefined {
  try {
    const typedResource = Resource as unknown as Record<string, Record<string, string>>;
    if (typedResource[resourceName] && typedResource[resourceName][prop]) {
      return typedResource[resourceName][prop];
    }
  } catch {
    // SST Resources not initialized/accessible
  }

  // Fallback to environment variables
  const envKey = `${resourceName.toUpperCase()}_${prop.toUpperCase()}`;
  return process.env[envKey] || process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;
}

/**
 * Safely gets a Resource name (like Table Name).
 */
export function getResourceName(resourceName: string): string | undefined {
  try {
    const typedResource = Resource as unknown as Record<string, Record<string, string>>;
    if (typedResource[resourceName] && typedResource[resourceName].name) {
      return typedResource[resourceName].name;
    }
  } catch {
    // SST Resources not initialized/accessible
  }

  // Fallback to environment variables
  const envKey = `${resourceName.toUpperCase()}_NAME`;
  return process.env[envKey];
}
