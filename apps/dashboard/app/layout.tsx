import './globals.css';

import type { Metadata } from 'next';
import { ConvexClientProvider } from '@/components/ConvexClientProvider';

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
    <html lang="en">
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
