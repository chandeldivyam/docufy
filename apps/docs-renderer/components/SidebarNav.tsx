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
    return (
      <aside
        aria-label="Documentation sidebar"
        className="sticky top-0 h-svh border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] text-[var(--sidebar-fg)] p-3 flex flex-col gap-3"
      />
    );
  }

  const spaceOptions = spaces.map(({ slug, name, entry }) => ({ slug, name, entry }));
  const storageKey = `dfy:nav:${manifest.buildId}:${currentSpace}`;

  return (
    <aside
      aria-label="Documentation sidebar"
      className="sticky top-0 h-svh border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] text-[var(--sidebar-fg)] p-3 flex flex-col gap-3"
    >
      <SidebarSpaceSwitcher spaces={spaceOptions} currentSpace={currentSpace} hrefPrefix={hrefPrefix} />
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <SidebarNavClient
          nodes={selected.items}
          hrefPrefix={hrefPrefix}
          storageKey={storageKey}
        />
      </div>
    </aside>
  );
}
