// apps/docs-renderer/app/(site)/[space]/[[...slug]]/metadata.ts
import { fetchManifestV3 } from '../../../../lib/fetchers';
import { headers } from 'next/headers';
import { currentBasePath } from '../../../../lib/site';
import { getPointer } from '../../../../lib/pointer';

export const runtime = 'edge';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ space: string; slug?: string[] }>;
}) {
  const { space, slug } = await params;
  const pointer = await getPointer();
  const manifest = await fetchManifestV3(pointer.manifestUrl);

  const route = `/${space}/${(slug ?? []).join('/')}`.replace(/\/$/, '');
  const p = manifest.pages[route];
  const title = p?.title ?? manifest.site.name ?? 'Docs';

  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || '';
  const proto = headersList.get('x-forwarded-proto') ?? 'https';
  const origin = `${proto}://${host}`;
  const prefix = (await currentBasePath()) || pointer.basePath || '';
  const canonical = p
    ? `${origin}${prefix}${route}`
    : `${origin}${prefix}/${manifest.routing.defaultSpace}`;

  return {
    title,
    alternates: { canonical },
    openGraph: { title, url: canonical },
    twitter: { title },
  } as const;
}
