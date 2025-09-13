import './globals.css';
import { getBlobBaseUrl } from '../lib/site';

export const runtime = 'edge';
export const preferredRegion = 'auto';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const base = getBlobBaseUrl();
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href={base} />
        <link rel="dns-prefetch" href={base} />
      </head>
      <body>{children}</body>
    </html>
  );
}
