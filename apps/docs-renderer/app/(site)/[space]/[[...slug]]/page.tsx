// apps/docs-renderer/app/(site)/[space]/[[...slug]]/page.tsx
import { Suspense } from 'react';
import { fetchManifestV3, fetchPageBlob } from '../../../../lib/fetchers';
import Content from '../../../../components/Content';
import { getPointer } from '../../../../lib/pointer';
import { absoluteUrlForRoute } from '../../../../lib/site';

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
  const pageUrl = await absoluteUrlForRoute(route || '/');
  const showMobileTopbar = manifest.site.layout !== 'tabs';

  return (
    <Suspense fallback={<></>}>
      <Content
        blobPromise={blobPromise}
        previous={page.previous}
        next={page.next}
        pageUrl={pageUrl}
        showMobileTopbar={showMobileTopbar}
        lastModified={page.lastModified}
      />
    </Suspense>
  );
}
export { generateMetadata } from './metadata';
