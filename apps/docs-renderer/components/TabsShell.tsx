import type { ReactNode } from 'react';
import type { Manifest, Tree } from '@/lib/types';
import SidebarTree from '@/components/SidebarTree';
import TopBar from '@/components/TopBar';
import SpaceTabs from '@/components/SpaceTabs';

export default async function TabsShell({
  manifest,
  tree,
  hrefPrefix,
  space,
  children,
}: {
  manifest: Manifest;
  tree: Tree;
  hrefPrefix: string;
  space: string;
  children: ReactNode;
}) {
  return (
    <div className="dfy-tabs-chrome">
      {/* Keep headers OUTSIDE the grid */}
      <TopBar manifest={manifest} tree={tree} hrefPrefix={hrefPrefix} />
      <SpaceTabs manifest={manifest} hrefPrefix={hrefPrefix} currentSpace={space} />

      <div className="dfy-root">
        <SidebarTree manifest={manifest} tree={tree} currentSpace={space} hrefPrefix={hrefPrefix} />
        <main className="dfy-main">
          <div className="dfy-content">{children}</div>
        </main>
      </div>
    </div>
  );
}
