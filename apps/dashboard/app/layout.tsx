import './globals.css';
import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/theme/NextThemeProvider';
import { ClerkProvider } from '@clerk/nextjs';
import { ConvexClientProvider } from '@/components/ConvexClientProvider'; // <-- move here

export const metadata: Metadata = {
  title: 'Docufy',
  description: 'Docufy - Documentation made easy!',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ClerkProvider>
          <ConvexClientProvider>
            {/* now wraps the whole app */}
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
              {children}
            </ThemeProvider>
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
