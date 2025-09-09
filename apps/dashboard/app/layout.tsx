import './globals.css';

import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/theme/NextThemeProvider';
import { AuthKitProvider } from '@workos-inc/authkit-nextjs/components';

export const metadata: Metadata = {
  title: 'Docufy',
  description: 'Docufy - Documentation made easy!',
  icons: {
    icon: [{ url: '/favicon.ico' }],
  },
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
