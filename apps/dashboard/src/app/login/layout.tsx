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
import { ThemeProvider } from '@/components/Providers/ThemeProvider';
import { ExtensionProvider } from '@/components/Providers/ExtensionProvider';

export const metadata: Metadata = {
  title: `${process.env.NEXT_PUBLIC_APP_TITLE || 'ClawCenter'} | Authentication`,
  description: 'Secure access to the Command & Control Hub',
  icons: {
    icon: '/icon.png',
    shortcut: '/favicon.ico',
    apple: '/icon.png',
  },
};

export const dynamic = 'force-dynamic';

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let initialLocale: 'en' | 'cn' = 'cn';
  try {
    const locale = await ConfigManager.getTypedConfig<string>(CONFIG_KEYS.ACTIVE_LOCALE, 'cn');
    initialLocale = (locale === 'en' ? 'en' : 'cn') as 'en' | 'cn';
  } catch (err) {
    console.debug('[Dashboard] Using default locale for auth:', err);
  }

  return (
    <html
      lang={initialLocale}
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <style>{`
          :root {
            --brand-primary: ${process.env.NEXT_PUBLIC_PRIMARY_COLOR || '#008f5a'};
            --cyber-blue: ${process.env.NEXT_PUBLIC_ACCENT_COLOR || '#007a8a'};
          }
          .dark {
            --brand-primary: ${process.env.NEXT_PUBLIC_PRIMARY_COLOR_DARK || '#00ffa3'};
            --cyber-blue: ${process.env.NEXT_PUBLIC_ACCENT_COLOR_DARK || '#00e0ff'};
          }
        `}</style>
      </head>
      <body
        suppressHydrationWarning
        className="min-h-full flex bg-background text-foreground font-mono text-base antialiased"
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <ExtensionProvider>
            <TranslationsProvider initialLocale={initialLocale}>
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
