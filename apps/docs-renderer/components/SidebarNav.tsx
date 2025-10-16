import type { Manifest, Tree } from '../lib/types';
import SidebarNavClient from './islands/SidebarNavClient';
import SidebarSpaceSwitcher from './islands/SidebarSpaceSwitcher';
import ThemeToggle from './islands/ThemeToggle';
import { Button } from './ui/button';
import SearchTrigger from './search/SearchTrigger';
import Link from 'next/link';

function sortSpaces(manifest: Manifest) {
  return manifest.nav.spaces.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function NavLinkButton({
  btn,
  hrefPrefix,
}: {
  btn: {
    id: string;
    label: string;
    href: string;
    iconSvg?: string | null;
    target?: '_self' | '_blank';
  };
  hrefPrefix: string;
}) {
  const isExternal = /^(https?:)?\/\//i.test(btn.href);
  const href = isExternal ? btn.href : `${hrefPrefix}${btn.href}`;

  return (
    <Button
      key={btn.id}
      variant="ghost"
      className="sidebar-link h-9 w-full justify-start text-[15px] font-medium"
      asChild
    >
      <Link
        prefetch={!isExternal}
        href={href}
        target={btn.target ?? (isExternal ? '_blank' : undefined)}
        rel={btn.target === '_blank' || isExternal ? 'noopener noreferrer' : undefined}
      >
        {btn.iconSvg ? (
          <span
            className="mr-2 inline-block h-4 w-4"
            dangerouslySetInnerHTML={{ __html: btn.iconSvg }}
          />
        ) : null}
        {btn.label}
      </Link>
    </Button>
  );
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
  const { sidebar_top, sidebar_bottom } = tree.buttons;

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
      <SearchTrigger />
      <SidebarSpaceSwitcher
        spaces={spaceOptions}
        currentSpace={currentSpace}
        hrefPrefix={hrefPrefix}
      />
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {sidebar_top?.length ? (
          <div className="mb-4 space-y-1">
            {sidebar_top.map((btn) => (
              <NavLinkButton key={btn.id} btn={btn} hrefPrefix={hrefPrefix} />
            ))}
          </div>
        ) : null}
        <SidebarNavClient nodes={selected.items} hrefPrefix={hrefPrefix} storageKey={storageKey} />
      </div>

      {/* ---- Non-scrolling bottom: stays visible ---- */}
      {sidebar_bottom?.length ? (
        <div
          className="mt-2 space-y-1 border-t border-[var(--sidebar-border)] pt-2"
          aria-label="Sidebar footer actions"
        >
          {sidebar_bottom.map((btn) => (
            <NavLinkButton key={btn.id} btn={btn} hrefPrefix={hrefPrefix} />
          ))}
        </div>
      ) : null}
    </aside>
  );
}
