import './globals.css';

import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/theme/NextThemeProvider';
import { AuthKitProvider } from '@workos-inc/authkit-nextjs/components';

export const metadata: Metadata = {
  title: 'Docufy Dashboard',
  description: 'Admin dashboard for Docufy',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AuthKitProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
          </ThemeProvider>
        </AuthKitProvider>
      </body>
    </html>
  );
}
