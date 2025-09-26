// apps/docs-renderer/components/SidebarNav.tsx
import type { Manifest, Tree } from '../lib/types';
import SidebarNavClient from './islands/SidebarNavClient';
import SidebarSpaceSwitcher from './islands/SidebarSpaceSwitcher';

function sortSpaces(manifest: Manifest) {
  return manifest.nav.spaces.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export default function SidebarNav({
  manifest,
  tree,
  currentSpace,
  hrefPrefix = '',
}: {
  manifest: Manifest;
  tree: Tree;
  currentSpace: string;
  hrefPrefix?: string;
}) {
  const spaces = sortSpaces(manifest);
  const selected = tree.spaces.find((space) => space.space.slug === currentSpace);
  if (!selected) {
    return <aside className="dfy-sidebar" aria-label="Documentation sidebar" />;
  }

  const spaceOptions = spaces.map(({ slug, name, entry }) => ({ slug, name, entry }));
  const storageKey = `dfy:nav:${manifest.buildId}:${currentSpace}`;

  return (
    <aside className="dfy-sidebar" aria-label="Documentation sidebar">
      <SidebarSpaceSwitcher spaces={spaceOptions} currentSpace={currentSpace} hrefPrefix={hrefPrefix} />
      <div className="dfy-nav-scroll">
        <SidebarNavClient
          nodes={selected.items}
          hrefPrefix={hrefPrefix}
          storageKey={storageKey}
        />
      </div>
    </aside>
  );
}
