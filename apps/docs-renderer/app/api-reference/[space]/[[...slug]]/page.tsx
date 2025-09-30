// apps/docs-renderer/app/api-reference/[space]/[[...slug]]/page.tsx
import { APIPage } from 'fumadocs-openapi/ui';
import { fetchManifestV3, fetchPageBlob } from '../../../../lib/fetchers';
import { getPointer } from '../../../../lib/pointer';
import SidebarNav from '../../../../components/SidebarNav';
import DocPageFrame from '../../../../components/DocPageFrame';
import { fetchTreeV2 } from '../../../../lib/fetchers';
import { currentBasePath } from '../../../../lib/site';
import { openapi } from '@/lib/openapi';

export const runtime = 'nodejs'; // Node.js runtime for API pages

async function loadNavData() {
  const pointer = await getPointer();
  const [manifest, tree, basePath] = await Promise.all([
    fetchManifestV3(pointer.manifestUrl),
    fetchTreeV2(pointer.treeUrl),
    currentBasePath(),
  ]);
  return {
    manifest,
    tree,
    hrefPrefix: basePath || pointer.basePath || '',
  };
}

export default async function ApiHandler({
  params,
}: {
  params: Promise<{ space: string; slug?: string[] }>;
}) {
  const { space, slug } = await params;
  const pointer = await getPointer();
  const manifest = await fetchManifestV3(pointer.manifestUrl);

  // Reconstruct the original route with /api-reference prefix
  const route = `/api-reference/${space}/${(slug ?? []).join('/')}`.replace(/\/$/, '');
  const page = manifest.pages[route];

  if (!page || page.kind !== 'api') {
    console.log('Page not found for route:', route);
    console.log('Available routes:', Object.keys(manifest.pages));
    return <div>API page not found for route: {route}</div>;
  }

  const blob = await fetchPageBlob(page.blob);

  if (!blob.apiPath || !blob.apiMethod || !blob.apiSpecBlobKey) {
    throw new Error('API page data is incomplete.');
  }

  // Load navigation data for sidebar
  const { manifest: navManifest, tree, hrefPrefix } = await loadNavData();

  return (
    <div className="dfy-root">
      <SidebarNav manifest={navManifest} tree={tree} currentSpace={space} hrefPrefix={hrefPrefix} />
      <main className="dfy-main">
        <div className="dfy-content">
          <DocPageFrame>
            <div className="fd-scope pt-5">
              <APIPage
                {...openapi.getAPIPageProps({
                  document: blob.apiSpecBlobKey,
                  operations: [{ path: blob.apiPath, method: blob.apiMethod.toLowerCase() }],
                  hasHead: true,
                })}
              />
            </div>
          </DocPageFrame>
        </div>
      </main>
    </div>
  );
}
