// apps/docs-renderer/app/(site)/[space]/layout.tsx
import SidebarNav from '../../../components/SidebarNav';
import { fetchManifestV3, fetchTreeV2 } from '../../../lib/fetchers';
import { currentBasePath } from '../../../lib/site';
import { getPointer } from '../../../lib/pointer';
import type { Manifest, Tree } from '../../../lib/types';

export const runtime = 'edge';

async function loadNavData(): Promise<{ manifest: Manifest; tree: Tree; hrefPrefix: string }> {
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

export default async function SpaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ space: string }>;
}) {
  const { space } = await params;
  const { manifest, tree, hrefPrefix } = await loadNavData();

  return (
    <div className="dfy-root">
      <SidebarNav manifest={manifest} tree={tree} currentSpace={space} hrefPrefix={hrefPrefix} />
      <main className="dfy-main">
        <div className="dfy-content">{children}</div>
      </main>
    </div>
  );
}
