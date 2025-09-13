// apps/docs-renderer/app/(site)/[space]/[[...slug]]/page.tsx
import { Suspense } from 'react';
import { fetchManifestV3, fetchTreeV2, fetchPageBlob } from '../../../../lib/fetchers';
import Sidebar from '../../../../components/Sidebar';
import Content from '../../../../components/Content';
import SpacesHeader from '../../../../components/SpacesHeader';
import { currentBasePath } from '../../../../lib/site';
import { getPointer } from '../../../../lib/pointer';

export const runtime = 'edge';

export default async function DocPage({
  params,
}: {
  params: Promise<{ space: string; slug?: string[] }>;
}) {
  const { space, slug } = await params;
  const pointer = await getPointer();

  const [manifest, tree] = await Promise.all([
    fetchManifestV3(pointer.manifestUrl),
    fetchTreeV2(pointer.treeUrl),
  ]);

  const route = `/${space}/${(slug ?? []).join('/')}`.replace(/\/$/, '');
  const page = manifest.pages[route] ?? manifest.pages[`/${space}`] ?? null;
  if (!page) return <div className="dfy-content">Page not found</div>;

  const blobPromise = fetchPageBlob(page.blob);
  const isTabs = manifest.site.layout === 'sidebar-tabs';
  const hrefPrefix = (await currentBasePath()) || pointer.basePath || '';

  return (
    <div className="dfy-root">
      {isTabs && (
        <header className="dfy-header">
          <SpacesHeader manifest={manifest} currentSpace={space} />
        </header>
      )}
      <div className="dfy-main">
        <Sidebar
          manifest={manifest}
          tree={tree}
          currentSpace={space}
          currentRoute={route}
          layout={manifest.site.layout}
          hrefPrefix={hrefPrefix}
        />
        <main className="dfy-content">
          <Suspense fallback={<div>Loading…</div>}>
            <Content blobPromise={blobPromise} />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
