// apps/docs-renderer/app/(site)/[space]/[[...slug]]/page.tsx
import { Suspense } from 'react';
import { fetchManifestV3, fetchPageBlob } from '../../../../lib/fetchers';
import Content from '../../../../components/Content';
import { getPointer } from '../../../../lib/pointer';

export const runtime = 'edge';

export default async function DocPage({
  params,
}: {
  params: Promise<{ space: string; slug?: string[] }>;
}) {
  const { space, slug } = await params;
  const pointer = await getPointer();
  const manifest = await fetchManifestV3(pointer.manifestUrl);

  const route = `/${space}/${(slug ?? []).join('/')}`.replace(/\/$/, '');
  const page = manifest.pages[route] ?? manifest.pages[`/${space}`] ?? null;
  if (!page) {
    return <div>Page not found</div>;
  }

  const blobPromise = fetchPageBlob(page.blob);

  return (
    <Suspense fallback={<div>Loading…</div>}>
      <Content blobPromise={blobPromise} />
    </Suspense>
  );
}
