import './globals.css';
import { getBlobBaseUrl } from '../lib/site';
import { ThemeProvider } from '../components/theme-provider';

export const runtime = 'edge';
export const preferredRegion = 'auto';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const base = getBlobBaseUrl();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href={base} />
        <link rel="dns-prefetch" href={base} />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
