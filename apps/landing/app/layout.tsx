import './globals.css';
import { ThemeProvider } from '../components/theme-provider';
import { SiteHeader } from '../components/site-header';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Docufy — Build a blazing‑fast help center',
  description:
    'Collaborate in real‑time, publish instantly, and keep support content in lockstep with your product.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background">
        <ThemeProvider>
          <SiteHeader />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
