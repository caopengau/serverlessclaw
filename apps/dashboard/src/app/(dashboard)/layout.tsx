import { Inter, JetBrains_Mono } from 'next/font/google';
import '../../globals.css';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AUTH } from '@/lib/constants';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
});

import Sidebar from '@/components/Sidebar';
import ChatBubble from '@/components/Chat/ChatBubble';
import { Toaster } from 'sonner';
import { TranslationsProvider } from '@/components/Providers/TranslationsProvider';
import { PageContextProvider } from '@/components/Providers/PageContextProvider';
import { UICommandProvider } from '@/components/Providers/UICommandProvider';
import { RealtimeProvider } from '@/components/Providers/RealtimeProvider';
import { ConfigManager } from '@claw/core/lib/registry/config';
import { CONFIG_KEYS } from '@claw/core/lib/constants';

import en from '../../../messages/en.json';
import cn from '../../../messages/cn.json';
import extEn from 'virtual-messages-en';
import extCn from 'virtual-messages-cn';

const mergedEn = { ...en, ...extEn };
const mergedCn = { ...cn, ...extCn };

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const initialLocale = (await ConfigManager.getTypedConfig<string>(
    CONFIG_KEYS.ACTIVE_LOCALE,
    'cn'
  )) as 'en' | 'cn';

  const messages = (initialLocale === 'cn' ? mergedCn : mergedEn) as any;
  const appTitle = process.env.NEXT_PUBLIC_APP_TITLE || messages.DASHBOARD_TITLE;

  return {
    title: `${appTitle} | ${messages.LAYOUT_NEURAL_HUB}`,
    description: messages.LAYOUT_DESCRIPTION,
    icons: {
      icon: '/icon.png',
      shortcut: '/favicon.ico',
      apple: '/icon.png',
    },
  };
}

import { ThemeProvider } from '@/components/Providers/ThemeProvider';
import { TenantProvider } from '@/components/Providers/TenantProvider';
import { UserProvider } from '@/components/Providers/UserProvider';
import { GlobalModals } from '@/components/GlobalModals';
import CommandPalette from '@/components/CommandPalette';
import { MainLayout } from '@/components/Layout/MainLayout';

import { PresenceProvider } from '@/components/Providers/PresenceProvider';
import { ExtensionProvider } from '@/components/Providers/ExtensionProvider';
import { ExtensionLoader } from '@/components/Providers/ExtensionLoader';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 0. Auth Protection (Server-side)
  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.get(AUTH.COOKIE_NAME)?.value === AUTH.COOKIE_VALUE;

  if (!isAuthenticated) {
    redirect('/login');
  }

  // 1. Fetch the active locale from system config (server-side)
  let initialLocale: 'en' | 'cn' = 'cn';
  try {
    initialLocale = (await ConfigManager.getTypedConfig<string>(
      CONFIG_KEYS.ACTIVE_LOCALE,
      'cn'
    )) as 'en' | 'cn';
  } catch (err) {
    console.error('[Dashboard] Failed to fetch initial locale:', err);
  }

  const messages = (initialLocale === 'cn' ? mergedCn : mergedEn) as any;

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
            <ExtensionLoader />
            <TranslationsProvider initialLocale={initialLocale}>
              <UserProvider>
                <TenantProvider>
                  <RealtimeProvider>
                    <PresenceProvider>
                      <UICommandProvider>
                        <PageContextProvider>
                          <GlobalModals />
                          <CommandPalette />
                          <a
                            href="#main-content"
                            className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-cyber-green focus:text-black"
                          >
                            {messages.LAYOUT_SKIP_TO_CONTENT}
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
                          <div className="flex h-screen w-full overflow-hidden">
                            <Sidebar />
                            <div className="flex-1 flex flex-col min-w-0 relative">
                              <MainLayout>{children}</MainLayout>
                              <ChatBubble />
                            </div>
                          </div>
                        </PageContextProvider>
                      </UICommandProvider>
                    </PresenceProvider>
                  </RealtimeProvider>
                </TenantProvider>
              </UserProvider>
            </TranslationsProvider>
          </ExtensionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
