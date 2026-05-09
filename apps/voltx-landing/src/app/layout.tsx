import './globals.css';
import { Inter, JetBrains_Mono } from 'next/font/google';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
});

export const metadata = {
  title: 'Voltx | AI-Native Energy Grid',
  description: 'Synchronizing the global energy transition.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased bg-[#020202] font-mono text-white m-0 p-0 overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
