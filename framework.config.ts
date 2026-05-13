/**
 * Global Framework Configuration
 * This file centralizes branding and identity for the entire ServerlessClaw ecosystem.
 * Projects like Enerlink Nexus should override these values in their own config injection.
 */

export interface IFrameworkConfig {
  brand: {
    name: string;
    shortName: string;
    logo: string;
    favicon: string;
  };
  theme: {
    defaultMode: 'light' | 'dark';
    primaryColor: string;
  };
  locales: {
    supported: string[];
    default: string;
  };
}

export const frameworkConfig: IFrameworkConfig = {
  brand: {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'NexusCenter',
    shortName: process.env.NEXT_PUBLIC_APP_SHORT_NAME || 'Nexus',
    logo: process.env.NEXT_PUBLIC_APP_LOGO || '/icon.png',
    favicon: '/favicon.ico',
  },
  theme: {
    defaultMode: 'dark',
    primaryColor: '#00FF9D', // Cyber Green
  },
  locales: {
    supported: ['en', 'cn'],
    default: 'en',
  },
};
