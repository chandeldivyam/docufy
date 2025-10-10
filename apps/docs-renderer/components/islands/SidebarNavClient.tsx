'use client';

import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DynamicIcon, type IconName } from 'lucide-react/dynamic';
import type { UiTreeItem } from '../../lib/types';

const INDENT = 12;

function getNodeId(node: UiTreeItem) {
  return node.route || `group:${node.slug}`;
}

function containsRoute(nodes: UiTreeItem[], route: string): boolean {
  return nodes.some(
    (node) => node.route === route || (node.children && containsRoute(node.children, route)),
  );
}

function collectAncestors(nodes: UiTreeItem[], route: string, acc: string[] = []) {
  for (const node of nodes) {
    if (!node.children?.length) {
      continue;
    }

    const matchesSelf = node.route
      ? route === node.route || route.startsWith(`${node.route}/`)
      : false;
    if (matchesSelf || containsRoute(node.children, route)) {
      acc.push(getNodeId(node));
      collectAncestors(node.children, route, acc);
    }
  }

  return acc;
}

function SmartTitle({ title, className = '' }: { title: string; className?: string }) {
  const [isOverflowing, setIsOverflowing] = useState(false);
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = textRef.current;
    if (element) {
      setIsOverflowing(element.scrollWidth > element.clientWidth);
    }
  }, [title]);

  return (
    <span
      ref={textRef}
      className={`flex-1 truncate ${className}`}
      title={isOverflowing ? title : undefined}
    >
      {title}
    </span>
  );
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
    const relative =
      hrefPrefix && pathname.startsWith(hrefPrefix) ? pathname.slice(hrefPrefix.length) : pathname;

    const normalized = relative || '/';
    const withSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
    return withSlash.length > 1 ? withSlash.replace(/\/$/, '') : withSlash;
  }, [pathname, hrefPrefix]);

  const initialExpanded = useMemo(
    () => collectAncestors(nodes, currentRoute),
    [nodes, currentRoute],
  );
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
  const isApiRoute = node.kind === 'api';

  // Get HTTP method from the node (you'll need to pass this through from the tree data)
  const getMethodBadge = (node: UiTreeItem) => {
    if (node.kind !== 'api') return null;

    // Extract method from the node - this assumes the method is available in the node data
    // You might need to adjust this based on your actual data structure
    const method = node.api?.method || 'API';

    const getMethodClasses = (method: string) => {
      const baseClasses = 'text-xs px-1.5 py-0.5 h-5 border-0 font-medium';

      switch (method.toUpperCase()) {
        case 'POST':
          return `${baseClasses} bg-blue-100 text-white dark:bg-blue-900 dark:text-blue-400 text-blue-900`;
        case 'GET':
          return `${baseClasses} bg-green-100 text-white dark:bg-green-900 dark:text-green-400 text-green-900`;
        case 'DELETE':
          return `${baseClasses} bg-red-100 text-white dark:bg-red-900 dark:text-red-400 text-red-900`;
        case 'PUT':
          return `${baseClasses} bg-yellow-100 text-white dark:bg-yellow-900 dark:text-yellow-400 text-yellow-900`;
        case 'PATCH':
          return `${baseClasses} bg-orange-100 text-white dark:bg-orange-900 dark:text-orange-400 text-orange-900`;
        default:
          return `${baseClasses} bg-[var(--sidebar-hover)] text-[var(--sidebar-fg-muted)]`;
      }
    };

    return <Badge className={getMethodClasses(method)}>{method.toUpperCase()}</Badge>;
  };

  if (node.kind === 'group') {
    return (
      <li>
        <div
          className="mb-1.5 mt-3 rounded-md px-2 py-1 font-bold tracking-normal text-[var(--sidebar-fg)]"
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
            className={cn('sidebar-link flex flex-1 items-center gap-2')}
            aria-current={isActive ? 'page' : undefined}
          >
            {isApiRoute && getMethodBadge(node)}
            {node.iconName && (
              <Suspense fallback={<span aria-hidden className="inline-block h-4 w-4" />}>
                <DynamicIcon name={node.iconName as unknown as IconName} className="h-4 w-4" />
              </Suspense>
            )}
            <SmartTitle title={node.title} />
          </Link>
        </div>
      </li>
    );
  }

  if ((node.kind === 'api_spec' || node.kind === 'api_tag') && hasChildren) {
    return (
      <li role="treeitem" aria-expanded={isExpanded}>
        <div className="flex items-center gap-2" style={{ marginLeft: depth * INDENT }}>
          <div
            className={cn('sidebar-link flex-1')}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onToggle(nodeId, !isExpanded)}
          >
            {node.iconName && (
              <Suspense fallback={<span aria-hidden className="inline-block h-4 w-4" />}>
                <DynamicIcon name={node.iconName as unknown as IconName} className="h-4 w-4" />
              </Suspense>
            )}
            <SmartTitle title={node.title} />
          </div>
          <button
            type="button"
            className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
            aria-expanded={isExpanded}
            onClick={() => onToggle(nodeId, !isExpanded)}
          >
            <ChevronRight
              className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-90')}
            />
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

  return (
    <li role="treeitem" aria-expanded={isExpanded}>
      <div className="flex items-center gap-2" style={{ marginLeft: depth * INDENT }}>
        <Link
          prefetch
          href={`${hrefPrefix}${node.route}`}
          aria-current={isActive ? 'page' : undefined}
          className={cn('sidebar-link flex flex-1 items-center gap-2')}
        >
          {isApiRoute && getMethodBadge(node)}
          {/* {node.iconName && (
            <DynamicIcon name={node.iconName as unknown as IconName} className="h-4 w-4" />
          )} */}
          <SmartTitle title={node.title} />
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
