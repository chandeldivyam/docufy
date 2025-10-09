// components/SidebarShell.tsx (server component)
import SidebarNav from '@/components/SidebarNav';
import { fetchManifestV3, fetchTreeV2 } from '@/lib/fetchers';
import { currentBasePath } from '@/lib/site';
import { getPointer } from '@/lib/pointer';
import type { ReactNode } from 'react';

export default async function SidebarShell({
  space,
  children,
}: {
  space: string;
  children: ReactNode;
}) {
  const pointer = await getPointer();
  const [manifest, tree, basePath] = await Promise.all([
    fetchManifestV3(pointer.manifestUrl),
    fetchTreeV2(pointer.treeUrl),
    currentBasePath(),
  ]);
  const hrefPrefix = basePath || pointer.basePath || '';

  return (
    <div className="dfy-root">
      <SidebarNav manifest={manifest} tree={tree} currentSpace={space} hrefPrefix={hrefPrefix} />
      <main className="dfy-main">
        <div className="dfy-content">{children}</div>
      </main>
    </div>
  );
}
