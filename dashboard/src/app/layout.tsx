import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex bg-[#0a0a0a] text-white font-mono text-base">
        <Toaster position="bottom-right" richColors />
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
