import type { Manifest, Tree } from '../lib/types';
import SidebarNavClient from './islands/SidebarNavClient';
import SidebarSpaceSwitcher from './islands/SidebarSpaceSwitcher';
import ThemeToggle from './islands/ThemeToggle';

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
        className="sticky top-0 flex h-svh flex-col gap-3 border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] p-3 text-[var(--sidebar-fg)]"
      />
    );
  }

  const spaceOptions = spaces.map(({ slug, name, entry }) => ({ slug, name, entry }));
  const storageKey = `dfy:nav:${manifest.buildId}:${currentSpace}`;

  return (
    <aside
      aria-label="Documentation sidebar"
      className="sticky top-0 flex h-svh flex-col gap-3 border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] p-3 text-[var(--sidebar-fg)]"
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          {/* Logo (prefers site.branding; falls back to logoUrl; else icon) */}
          {(() => {
            const light = manifest.site.branding?.logo?.light ?? manifest.site.logoUrl ?? '';
            const dark = manifest.site.branding?.logo?.dark ?? light;
            return (
              <div className="flex w-[100px] shrink-0 items-center justify-center">
                {/* show light in light mode */}
                {light ? (
                  <img src={light} alt="Logo" className="object-contain dark:hidden" />
                ) : (
                  <></>
                )}
                {/* show dark in dark mode if different */}
                {dark ? (
                  <img src={dark} alt="Logo" className="hidden object-contain dark:block" />
                ) : (
                  <></>
                )}
              </div>
            );
          })()}
          <span className="font-semibold">{manifest.site.name}</span>
        </div>
        <ThemeToggle />
      </div>
      <SidebarSpaceSwitcher
        spaces={spaceOptions}
        currentSpace={currentSpace}
        hrefPrefix={hrefPrefix}
      />
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <SidebarNavClient nodes={selected.items} hrefPrefix={hrefPrefix} storageKey={storageKey} />
      </div>
    </aside>
  );
}
