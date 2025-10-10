// components/SidebarShell.tsx (server component)
import SidebarNav from '@/components/SidebarNav';
import { fetchManifestV3, fetchTreeV2 } from '@/lib/fetchers';
import { currentBasePath } from '@/lib/site';
import { getPointer } from '@/lib/pointer';
import type { ReactNode } from 'react';
import type { Manifest, Tree } from '@/lib/types';

export default async function SidebarShell({
  space,
  children,
  manifest: manifestProp,
  tree: treeProp,
  hrefPrefix: hrefPrefixProp,
}: {
  space: string;
  children: ReactNode;
  manifest?: Manifest;
  tree?: Tree;
  hrefPrefix?: string;
}) {
  // Allow preloaded data (for LayoutSwitcher) or fetch locally as fallback.
  let manifest: Manifest | undefined = manifestProp;
  let tree: Tree | undefined = treeProp;
  let hrefPrefix = hrefPrefixProp;

  if (!manifest || !tree || hrefPrefix === undefined) {
    const pointer = await getPointer();
    const [m, t, basePath] = await Promise.all([
      manifest ? Promise.resolve(manifest) : fetchManifestV3(pointer.manifestUrl),
      tree ? Promise.resolve(tree) : fetchTreeV2(pointer.treeUrl),
      hrefPrefix === undefined ? currentBasePath() : Promise.resolve(''),
    ]);
    manifest = m;
    tree = t;
    if (hrefPrefix === undefined) hrefPrefix = basePath || pointer.basePath || '';
  }

  return (
    <div className="dfy-root">
      {/* non-null by construction above */}
      <SidebarNav manifest={manifest!} tree={tree!} currentSpace={space} hrefPrefix={hrefPrefix!} />
      <main className="dfy-main">
        <div className="dfy-content">{children}</div>
      </main>
    </div>
  );
}
