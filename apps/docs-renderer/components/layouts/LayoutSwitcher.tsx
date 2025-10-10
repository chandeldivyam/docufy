import type { ReactNode } from 'react';
import SidebarShell from '@/components/SidebarShell';
import TabsShell from '@/components/TabsShell';
import { fetchManifestV3, fetchTreeV2 } from '@/lib/fetchers';
import { getPointer } from '@/lib/pointer';
import { currentBasePath } from '@/lib/site';

export default async function LayoutSwitcher({
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

  if (manifest.site.layout === 'tabs') {
    return (
      <TabsShell manifest={manifest} tree={tree} hrefPrefix={hrefPrefix} space={space}>
        {children}
      </TabsShell>
    );
  }

  // Default: sidebar-dropdown (reuse existing shell)
  return (
    <SidebarShell manifest={manifest} tree={tree} hrefPrefix={hrefPrefix} space={space}>
      {children}
    </SidebarShell>
  );
}
