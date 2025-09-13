// apps/docs-renderer/app/(site)/[space]/[[...slug]]/metadata.ts
import { fetchLatest, fetchManifestV3 } from '../../../../lib/fetchers';
import { headers } from 'next/headers';

export const runtime = 'edge';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ space: string; slug?: string[] }>;
}) {
  const { space, slug } = await params;
  const pointer = await fetchLatest();
  const manifest = await fetchManifestV3(pointer.manifestUrl);

  const route = `/${space}/${(slug ?? []).join('/')}`.replace(/\/$/, '');
  const p = manifest.pages[route];
  const title = p?.title ?? manifest.site.name ?? 'Docs';

  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || '';
  const proto = headersList.get('x-forwarded-proto') ?? 'https';
  const origin = `${proto}://${host}`;
  const canonical = p ? `${origin}${route}` : `${origin}/${manifest.routing.defaultSpace}`;

  return {
    title,
    alternates: { canonical },
    openGraph: { title, url: canonical },
    twitter: { title },
  } as const;
}
