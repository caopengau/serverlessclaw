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
    logoBanner: string;
    favicon: string;
  };
  theme: {
    defaultMode: 'light' | 'dark';
    primaryColor: string; // Light mode brand color
    primaryColorDark: string; // Dark mode brand color
  };
  locales: {
    supported: string[];
    default: string;
  };
}

export const frameworkConfig: IFrameworkConfig = {
  brand: {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'ClawCenter',
    shortName: process.env.NEXT_PUBLIC_APP_SHORT_NAME || 'Claw',
    logo: process.env.NEXT_PUBLIC_APP_LOGO || '/icon.png',
    logoBanner: process.env.NEXT_PUBLIC_APP_LOGO_BANNER || '',
    favicon: '/favicon.ico',
  },
  theme: {
    defaultMode: 'dark',
    primaryColor: process.env.NEXT_PUBLIC_PRIMARY_COLOR || '#008f5a', // Default Cyber Green (Light)
    primaryColorDark: process.env.NEXT_PUBLIC_PRIMARY_COLOR_DARK || '#00ffa3', // Default Cyber Green (Dark)
  },
  locales: {
    supported: ['en', 'cn'],
    default: 'en',
  },
};
