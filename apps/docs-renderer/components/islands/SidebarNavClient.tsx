'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { DynamicIcon, type IconName } from 'lucide-react/dynamic';
import type { UiTreeItem } from '../../lib/types';

const INDENT = 12;

function getNodeId(node: UiTreeItem) {
  return node.route || `group:${node.slug}`;
}

function containsRoute(nodes: UiTreeItem[], route: string): boolean {
  return nodes.some((node) => node.route === route || (node.children && containsRoute(node.children, route)));
}

function collectAncestors(nodes: UiTreeItem[], route: string, acc: string[] = []) {
  for (const node of nodes) {
    if (!node.children?.length) {
      continue;
    }

    const matchesSelf = node.route ? (route === node.route || route.startsWith(`${node.route}/`)) : false;
    if (matchesSelf || containsRoute(node.children, route)) {
      acc.push(getNodeId(node));
      collectAncestors(node.children, route, acc);
    }
  }

  return acc;
}

function useExpanded(initial: string[], storageKey?: string) {
  const [expanded, setExpanded] = useState<string[]>(() => {
    if (!storageKey) return initial;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw) as string[];
    } catch {
      return initial;
    }
    return initial;
  });

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(expanded));
    } catch {
      // ignore persistence failures (private mode, quota, etc.)
    }
  }, [expanded, storageKey]);

  return [expanded, setExpanded] as const;
}

export default function SidebarNavClient({
  nodes,
  hrefPrefix,
  storageKey,
}: {
  nodes: UiTreeItem[];
  hrefPrefix: string;
  storageKey?: string;
}) {
  const pathname = usePathname();
  const currentRoute = useMemo(() => {
    const relative = hrefPrefix && pathname.startsWith(hrefPrefix)
      ? pathname.slice(hrefPrefix.length)
      : pathname;

    const normalized = relative || '/';
    const withSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
    return withSlash.length > 1 ? withSlash.replace(/\/$/, '') : withSlash;
  }, [pathname, hrefPrefix]);

  const initialExpanded = useMemo(() => collectAncestors(nodes, currentRoute), [nodes, currentRoute]);
  const [expanded, setExpanded] = useExpanded(initialExpanded, storageKey);

  useEffect(() => {
    const requiredAncestors = collectAncestors(nodes, currentRoute);
    setExpanded((prev) => {
      if (!requiredAncestors.length) return prev;
      const existing = new Set(prev);
      let changed = false;
      for (const id of requiredAncestors) {
        if (!existing.has(id)) {
          existing.add(id);
          changed = true;
        }
      }
      return changed ? Array.from(existing) : prev;
    });
  }, [currentRoute, nodes, setExpanded]);

  return (
    <nav aria-label="Section navigation" role="tree">
      <ul className="m-0 list-none p-0">
        {nodes.map((node) => (
          <Node
            key={node.route || node.slug}
            node={node}
            depth={0}
            expanded={expanded}
            onToggle={(id, open) =>
              setExpanded((prev) => {
                if (open) return prev.includes(id) ? prev : [...prev, id];
                return prev.filter((value) => value !== id);
              })
            }
            currentRoute={currentRoute}
            hrefPrefix={hrefPrefix}
          />
        ))}
      </ul>
    </nav>
  );
}

function Node({
  node,
  depth,
  expanded,
  onToggle,
  currentRoute,
  hrefPrefix,
}: {
  node: UiTreeItem;
  depth: number;
  expanded: string[];
  onToggle: (id: string, open: boolean) => void;
  currentRoute: string;
  hrefPrefix: string;
}) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const nodeId = getNodeId(node);
  const isExpanded = hasChildren && expanded.includes(nodeId);
  const isActive = node.route === currentRoute;

  if (node.kind === 'group') {
    return (
      <li>
        <div
          className="mt-3 mb-1.5 rounded-md px-2 py-1 text-[12px] font-bold tracking-normal text-[var(--sidebar-fg)]"
          style={{ marginLeft: depth * INDENT }}
        >
          {node.title}
        </div>
        {hasChildren && (
          <ul className="sidebar-nav-group m-0 list-none" role="group">
            {node.children!.map((child) => (
              <Node
                key={child.route || child.slug}
                node={child}
                depth={depth + 1}
                expanded={expanded}
                onToggle={onToggle}
                currentRoute={currentRoute}
                hrefPrefix={hrefPrefix}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  if (!hasChildren) {
    return (
      <li role="treeitem" aria-expanded={false} aria-current={isActive ? 'page' : undefined}>
        <div className="flex items-center gap-2" style={{ marginLeft: depth * INDENT }}>
          <Link
            prefetch
            href={`${hrefPrefix}${node.route}`}
            className={cn('sidebar-link flex-1')}
            aria-current={isActive ? 'page' : undefined}
          >
            {node.iconName && (
              <DynamicIcon name={node.iconName as unknown as IconName} className="h-4 w-4" />
            )}
            <span className="flex-1 truncate">{node.title}</span>
          </Link>
        </div>
      </li>
    );
  }

  return (
    <li role="treeitem" aria-expanded={isExpanded}>
      <div className="flex items-center gap-2" style={{ marginLeft: depth * INDENT }}>
        <Link
          prefetch
          href={`${hrefPrefix}${node.route}`}
          aria-current={isActive ? 'page' : undefined}
          className={cn('sidebar-link flex-1')}
        >
          {node.iconName && (
            <DynamicIcon name={node.iconName as unknown as IconName} className="h-4 w-4" />
          )}
          <span className="flex-1 truncate">{node.title}</span>
        </Link>
        <button
          type="button"
          className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
          aria-expanded={isExpanded}
          onClick={() => onToggle(nodeId, !isExpanded)}
        >
          <ChevronRight className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-90')} />
        </button>
      </div>
      {isExpanded && (
        <ul className="m-0 list-none" role="group">
          {node.children!.map((child) => (
            <Node
              key={child.route || child.slug}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              currentRoute={currentRoute}
              hrefPrefix={hrefPrefix}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
