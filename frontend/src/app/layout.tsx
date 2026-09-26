import './globals.css';
import Sidebar from '@/components/layout/Sidebar';
import { Inter, Space_Grotesk } from 'next/font/google';
import { ReactNode } from 'react';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });

export const metadata = {
  title: 'RasoiIQ',
  description: 'AI-Powered Institutional Food Waste Reduction',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans flex w-full min-h-screen bg-ink-base text-content-primary antialiased selection:bg-accent-primary/30 selection:text-content-primary relative`}>
        <Sidebar />
        <main className="ml-[260px] flex-1 w-full min-h-screen relative z-10">
          {children}
        </main>
      </body>
    </html>
  );
}
