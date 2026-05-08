import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import '../../globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
});

import { Toaster } from 'sonner';
import { TranslationsProvider } from '@/components/Providers/TranslationsProvider';
import { ConfigManager } from '@claw/core/lib/registry/config';
import { CONFIG_KEYS } from '@claw/core/lib/constants';

export const metadata: Metadata = {
  title: 'ClawCenter | Neural Hub',
  description: 'Autonomous Agent Command & Control Hub',
};

export const dynamic = 'force-dynamic';

import { ThemeProvider } from '@/components/Providers/ThemeProvider';
import { ExtensionProvider } from '@/components/Providers/ExtensionProvider';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch the active locale from system config (server-side)
  // Voltx project defaults to Chinese
  let initialLocale: 'en' | 'cn' = 'cn';
  try {
    // Only attempt config fetch if we can reach the ConfigManager
    const locale = await ConfigManager.getTypedConfig<string>(CONFIG_KEYS.ACTIVE_LOCALE, 'cn');
    initialLocale = (locale === 'en' ? 'en' : 'cn') as 'en' | 'cn';
  } catch (err) {
    // Silent fallback to 'cn' for marketing pages
    console.debug('[Dashboard] Using default locale for marketing:', err);
  }

  return (
    <html
      lang={initialLocale}
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex bg-background text-foreground font-mono text-base antialiased"
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <ExtensionProvider>
            <TranslationsProvider initialLocale={initialLocale}>
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-cyber-green focus:text-black"
              >
                Skip to content
              </a>
              <Toaster
                position="bottom-right"
                toastOptions={{
                  className: 'cyber-toast',
                  classNames: {
                    success: 'cyber-toast-success',
                    error: 'cyber-toast-error',
                    description: 'cyber-toast-description',
                  },
                }}
              />
              <div className="flex-1 overflow-y-auto">{children}</div>
            </TranslationsProvider>
          </ExtensionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
