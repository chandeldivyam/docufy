// apps/docs-renderer/components/Sidebar.tsx
'use client';

import Link from 'next/link';
import { useMemo, useState, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { Tree, UiTreeItem, Manifest } from '../lib/types';
import { Book, ChevronsUpDown, ChevronRight, FileText } from 'lucide-react';

function isActive(route: string, current: string): boolean {
  return route === current;
}
function isAncestor(node: UiTreeItem, current: string): boolean {
  const children = node.children ?? [];
  if (children.length === 0) return false;
  if (children.some((c) => c.route === current)) return true;
  return children.some((c) => isAncestor(c, current));
}

export default function Sidebar({
  manifest,
  tree,
  currentSpace,
  currentRoute,
  layout,
  hrefPrefix = '',
}: {
  manifest: Manifest;
  tree: Tree;
  currentSpace: string;
  currentRoute: string;
  layout: Manifest['site']['layout'];
  hrefPrefix?: string;
}) {
  const router = useRouter();
  const spaces = useMemo(
    () => manifest.nav.spaces.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [manifest],
  );

  const selected = tree.spaces.find((s) => s.space.slug === currentSpace);
  if (!selected) return null;

  return (
    <aside
      aria-label="Documentation"
      className="sticky top-0 flex h-svh flex-col gap-3 border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] p-3 text-[var(--sidebar-fg)]"
    >
      {layout === 'sidebar-dropdown' && (
        <div className="flex flex-col gap-1.5">
          <label className="sr-only" htmlFor="space-select">
            Select space
          </label>
          <div className="relative">
            <Book
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
            />
            <select
              id="space-select"
              className="block w-full appearance-none rounded-[var(--radius)] border border-[var(--sidebar-border)] bg-[var(--bg)] px-8 py-2 pr-9 text-sm text-[var(--fg)] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              value={currentSpace}
              onChange={(e) => {
                const slug = e.target.value;
                const entry = spaces.find((s) => s.slug === slug)?.entry ?? `/${slug}`;
                router.push(`${hrefPrefix}${entry}`);
              }}
            >
              {spaces.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
            <ChevronsUpDown
              aria-hidden
              className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
            />
          </div>
        </div>
      )}

      <nav>
        <div className="sr-only">{selected.space.name}</div>
        <ul className="m-0 list-none p-0">
          {selected.items.map((n) => (
            <TreeItem
              key={n.route}
              node={n}
              currentRoute={currentRoute}
              depth={0}
              hrefPrefix={hrefPrefix}
            />
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function TreeItem({
  node,
  currentRoute,
  depth,
  hrefPrefix = '',
}: {
  node: UiTreeItem;
  currentRoute: string;
  depth: number;
  hrefPrefix?: string;
}) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const initiallyOpen = useMemo(() => isAncestor(node, currentRoute), [node, currentRoute]);
  const [open, setOpen] = useState<boolean>(initiallyOpen);

  // Keyboard a11y for disclosure
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!hasChildren) return;
    if (e.key === 'ArrowRight') setOpen(true);
    if (e.key === 'ArrowLeft') setOpen(false);
  };

  // Group nodes act as section labels (always expanded)
  if (node.kind === 'group') {
    return (
      <li>
        <div className="mb-1 mt-4 inline-block rounded-md bg-[color-mix(in_oklab,var(--sidebar-fg)_5%,var(--sidebar-bg))] px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          {node.title}
        </div>
        {hasChildren && (
          <ul
            className="m-0 list-none"
            style={{ borderLeft: 'none', marginLeft: 0, paddingLeft: 0 }}
          >
            {node.children!.map((c) => (
              <TreeItem
                key={c.route}
                node={c}
                currentRoute={currentRoute}
                depth={depth}
                hrefPrefix={hrefPrefix}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  const Row = (
    <div className="flex items-center gap-2" style={{ paddingLeft: depth * 12 }}>
      <Link
        prefetch
        href={`${hrefPrefix}${node.route}`}
        aria-current={isActive(node.route, currentRoute) ? 'page' : undefined}
        className={
          (isActive(node.route, currentRoute)
            ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
            : 'hover:bg-[var(--sidebar-hover)]') +
          ' block flex-1 rounded-md px-2.5 py-2 text-inherit no-underline'
        }
      >
        <FileText className="mr-3 h-4 w-4 text-[var(--muted)]" aria-hidden />
        <span className="flex-1 truncate">{node.title}</span>
      </Link>
      {hasChildren && (
        <button
          type="button"
          aria-expanded={open}
          className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          onClick={() => setOpen((v) => !v)}
          onKeyDown={onKeyDown}
          aria-label={open ? 'Collapse section' : 'Expand section'}
        >
          <ChevronRight
            className={
              open ? 'h-4 w-4 rotate-90 transition-transform' : 'h-4 w-4 transition-transform'
            }
          />
        </button>
      )}
    </div>
  );

  if (!hasChildren) return <li>{Row}</li>;

  return (
    <li>
      {Row}
      {open && (
        <ul className="m-0 list-none border-l border-[var(--border)]">
          {node.children!.map((c) => (
            <TreeItem
              key={c.route}
              node={c}
              currentRoute={currentRoute}
              depth={depth + 1}
              hrefPrefix={hrefPrefix}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
