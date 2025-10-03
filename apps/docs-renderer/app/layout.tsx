import './globals.css';
import { getBlobBaseUrl } from '../lib/site';
import { ThemeProvider } from '../components/theme-provider';
import { fetchTheme } from '../lib/fetchers';
import { getPointer } from '../lib/pointer';
import type { ThemeJson } from '../lib/types';

export const runtime = 'edge';
export const preferredRegion = 'auto';

function cssForTheme(theme: ThemeJson | null) {
  if (!theme) return '';
  const L = theme.light?.tokens ?? {};
  const LV = theme.light?.vars ?? {};
  const D = theme.dark?.tokens ?? {};
  const kv = (o: Record<string, string>) =>
    Object.entries(o)
      .map(([k, v]) => `${k}: ${v};`)
      .join('');
  return `
    @layer tokens {
      :root { ${kv(L)} ${kv(LV)} }
      :root.dark { ${kv(D)} }
    }`;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const base = getBlobBaseUrl();
  const ptr = await getPointer();
  const theme = await fetchTheme(ptr.themeUrl);
  const themeCss = cssForTheme(theme);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href={base} />
        <link rel="dns-prefetch" href={base} />
        {themeCss ? (
          <style nonce={undefined} dangerouslySetInnerHTML={{ __html: themeCss }} />
        ) : null}
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
