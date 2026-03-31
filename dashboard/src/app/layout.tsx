import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

import Sidebar from "@/components/Sidebar";
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: "ClawCenter | Neural Hub",
  description: "Autonomous Agent Command & Control Hub",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex bg-[#0a0a0a] text-white font-mono text-base">
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
            <main className="flex-1 flex flex-col min-h-0 pt-16 lg:pt-0">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
