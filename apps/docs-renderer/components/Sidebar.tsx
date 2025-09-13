// apps/docs-renderer/components/Sidebar.tsx
'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Tree, UiTreeItem } from '../lib/types';

function isActive(route: string, current: string): boolean {
  return route === current;
}

function isAncestor(node: UiTreeItem, current: string): boolean {
  const children = node.children ?? [];
  if (children.length === 0) return false;
  if (children.some((c) => c.route === current)) return true;
  return children.some((c) => isAncestor(c, current));
}

export default function Sidebar({ tree, currentRoute }: { tree: Tree; currentRoute: string }) {
  return (
    <aside className="dfy-sidebar" aria-label="Documentation">
      {tree.spaces.map(({ space, items }) => (
        <nav key={space.slug} className="dfy-space">
          <div className="dfy-space-title">{space.name}</div>
          <ul className="dfy-tree">
            {items.map((n) => (
              <TreeItem key={n.route} node={n} currentRoute={currentRoute} depth={0} />
            ))}
          </ul>
        </nav>
      ))}
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

  const Row = (
    <div className="dfy-row" style={{ paddingLeft: depth * 8 }}>
      {hasChildren ? (
        <button
          type="button"
          aria-expanded={open}
          className="dfy-disclosure"
          onClick={() => setOpen((v) => !v)}
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
