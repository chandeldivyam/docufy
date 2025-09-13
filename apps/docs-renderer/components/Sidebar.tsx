// apps/docs-renderer/components/Sidebar.tsx
'use client';

import Link from 'next/link';
import { useMemo, useState, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { Tree, UiTreeItem, Manifest } from '../lib/types';

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
}: {
  manifest: Manifest;
  tree: Tree;
  currentSpace: string;
  currentRoute: string;
  layout: Manifest['site']['layout'];
}) {
  const router = useRouter();
  const spaces = useMemo(
    () => manifest.nav.spaces.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [manifest],
  );

  const selected = tree.spaces.find((s) => s.space.slug === currentSpace);
  if (!selected) return null;

  return (
    <aside className="dfy-sidebar" aria-label="Documentation">
      {layout === 'sidebar-dropdown' && (
        <div className="dfy-space-select">
          <label className="sr-only" htmlFor="space-select">
            Select space
          </label>
          <select
            id="space-select"
            value={currentSpace}
            onChange={(e) => {
              const slug = e.target.value;
              const entry = spaces.find((s) => s.slug === slug)?.entry ?? `/${slug}`;
              router.push(entry);
            }}
          >
            {spaces.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <nav className="dfy-space">
        <div className="dfy-space-title">{selected.space.name}</div>
        <ul className="dfy-tree">
          {selected.items.map((n) => (
            <TreeItem key={n.route} node={n} currentRoute={currentRoute} depth={0} />
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
}: {
  node: UiTreeItem;
  currentRoute: string;
  depth: number;
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

  const Row =
    node.kind === 'group' ? (
      <div className="dfy-row" style={{ paddingLeft: depth * 12 }}>
        {hasChildren ? (
          <button
            type="button"
            aria-expanded={open}
            className="dfy-disclosure"
            onClick={() => setOpen((v) => !v)}
            onKeyDown={onKeyDown}
          />
        ) : (
          <span className="dfy-leaf" />
        )}
        <div role="heading" aria-level={Math.min(6, depth + 2)} className="dfy-group">
          {node.title}
        </div>
      </div>
    ) : (
      <div className="dfy-row" style={{ paddingLeft: depth * 12 }}>
        {hasChildren ? (
          <button
            type="button"
            aria-expanded={open}
            className="dfy-disclosure"
            onClick={() => setOpen((v) => !v)}
            onKeyDown={onKeyDown}
          />
        ) : (
          <span className="dfy-leaf" />
        )}
        <Link
          prefetch
          href={node.route}
          aria-current={isActive(node.route, currentRoute) ? 'page' : undefined}
          className={isActive(node.route, currentRoute) ? 'active' : undefined}
        >
          {node.title}
        </Link>
      </div>
    );

  if (!hasChildren) return <li>{Row}</li>;

  return (
    <li>
      {Row}
      {open && (
        <ul className="dfy-children">
          {node.children!.map((c) => (
            <TreeItem key={c.route} node={c} currentRoute={currentRoute} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
