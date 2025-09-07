// apps/dashboard/components/space/SpaceSidebar.tsx
'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { MoreHorizontal, Plus, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { useQueryWithStatus } from '@/lib/convexHooks';
import { getErrorMessage, isAuthError } from '@/lib/errors';
import type { Id } from '@/convex/_generated/dataModel';

/** Minimal shape expected from getTreeForSpace */
type BaseDocumentNode = {
  type: 'page' | 'group';
  title: string;
  slug: string;
  order: number;
  parentId?: Id<'documents'>;
  isHidden: boolean;
  pmsDocKey?: string;
};

// Backend document node with proper ID
type DocumentNode = BaseDocumentNode & {
  _id: Id<'documents'>;
};

// Backend tree node
type TreeNode = DocumentNode & {
  children: TreeNode[];
};

export function SpaceSidebar() {
  const params = useParams<{ projectId: string; spaceSlug: string }>();
  const projectId = params.projectId as unknown as Id<'projects'>;
  const spaceSlug = params.spaceSlug;

  // 1) Load spaces for this project so we can resolve the active space from the slug
  const spacesQuery = useQueryWithStatus(api.spaces.list, { projectId });

  const space = useMemo(() => {
    return spacesQuery.data?.find((s) => s.slug === spaceSlug) ?? null;
  }, [spacesQuery.data, spaceSlug]);

  if (spacesQuery.isPending) {
    return (
      <div className="space-y-2 p-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-6 w-5/6" />
      </div>
    );
  }

  if (spacesQuery.isError) {
    return (
      <div className="p-3">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{getErrorMessage(spacesQuery.error)}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!space) {
    return <div className="text-muted-foreground p-3 text-sm">Space not found.</div>;
  }

  return <SpaceSidebarInner projectId={projectId} spaceId={space._id} spaceSlug={space.slug} />;
}

function SpaceSidebarInner({
  projectId,
  spaceId,
  spaceSlug,
}: {
  projectId: Id<'projects'>;
  spaceId: Id<'spaces'>;
  spaceSlug: string;
}) {
  const router = useRouter();

  // 2) Load the entire tree with status
  const treeQuery = useQueryWithStatus(api.documents.getTreeForSpace, { spaceId });

  // 3) Mutations with optimistic updates against the tree query
  const createDoc = useMutation(api.documents.createDocument).withOptimisticUpdate(
    (store, { spaceId: sid, type, title, parentId }) => {
      // Only patch the visible space's tree
      const current = store.getQuery(api.documents.getTreeForSpace, { spaceId: sid }) as
        | TreeNode[]
        | undefined;
      if (!current) return;

      // Compute next order within the target parent (top level by default)
      const nextOrder = (() => {
        if (!parentId) return (current[current.length - 1]?.order ?? -1) + 1;
        const parent = findNode(current, parentId);
        const siblings = parent?.children ?? [];
        return (siblings[siblings.length - 1]?.order ?? -1) + 1;
      })();

      const optimisticId = `optimistic:${Math.random().toString(36).slice(2)}`;

      const optimisticNode: TreeNode = {
        _id: optimisticId as Id<'documents'>,
        type,
        title,
        slug: title,
        order: nextOrder,
        parentId,
        isHidden: false,
        children: [],
      };

      const next = parentId
        ? insertChild(current, parentId as Id<'documents'>, optimisticNode)
        : [...current, optimisticNode];

      store.setQuery(api.documents.getTreeForSpace, { spaceId: sid }, next);
    },
  );

  const updateDoc = useMutation(api.documents.updateDocument).withOptimisticUpdate(
    (store, { documentId, title, slug }) => {
      const current = store.getQuery(api.documents.getTreeForSpace, { spaceId }) as
        | TreeNode[]
        | undefined;
      if (!current) return;
      const next = mapNodes(current, (n) =>
        n._id === documentId ? { ...n, title: title ?? n.title, slug: slug ?? n.slug } : n,
      );
      store.setQuery(api.documents.getTreeForSpace, { spaceId }, next);
    },
  );

  const delDoc = useMutation(api.documents.deleteDocument).withOptimisticUpdate(
    (store, { documentId }) => {
      const current = store.getQuery(api.documents.getTreeForSpace, { spaceId }) as
        | TreeNode[]
        | undefined;
      if (!current) return;
      const next = removeNode(current, documentId as Id<'documents'>);
      store.setQuery(api.documents.getTreeForSpace, { spaceId }, next);
    },
  );

  async function onCreateTop(type: 'page' | 'group') {
    try {
      const title = type === 'group' ? 'New Section' : 'Untitled';
      const created = await createDoc({
        spaceId,
        type,
        title,
        slug: title,
      });
      if (type === 'page' && created?._id) {
        router.push(`/dashboard/${projectId}/spaces/${spaceSlug}/doc/${created._id}`);
      }
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  // Render states for the tree
  if (treeQuery.isPending) {
    return (
      <div className="flex h-full flex-col">
        <Header onCreateTop={onCreateTop} />
        <div className="space-y-1 p-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-5 w-36" />
        </div>
      </div>
    );
  }

  if (treeQuery.isError && !isAuthError(treeQuery.error)) {
    return (
      <div className="p-3">
        <Header onCreateTop={onCreateTop} />
        <Alert variant="destructive" className="mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{getErrorMessage(treeQuery.error)}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const tree = treeQuery.data ?? [];

  return (
    <div className="flex h-full flex-col">
      <Header onCreateTop={onCreateTop} />

      <div className="flex-1 overflow-y-auto p-2">
        {tree.length === 0 ? (
          <div className="text-muted-foreground p-2 text-sm">No documents yet</div>
        ) : (
          <Tree
            nodes={tree}
            projectId={projectId}
            spaceSlug={spaceSlug}
            onRename={async (id, nextTitle) => {
              try {
                await updateDoc({ documentId: id, title: nextTitle, slug: nextTitle });
              } catch (e) {
                toast.error(getErrorMessage(e));
              }
            }}
            onDelete={async (id) => {
              try {
                await delDoc({ documentId: id });
              } catch (e) {
                toast.error(getErrorMessage(e));
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ---------- Presentational bits ---------- */

function Header({ onCreateTop }: { onCreateTop: (t: 'page' | 'group') => void }) {
  return (
    <div className="flex items-center justify-between border-b px-3 py-2">
      <div className="text-sm font-medium">Pages</div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Plus className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => onCreateTop('page')}>New Page</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onCreateTop('group')}>New Group</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function Tree({
  nodes,
  projectId,
  spaceSlug,
  onRename,
  onDelete,
}: {
  nodes: TreeNode[];
  projectId: Id<'projects'>;
  spaceSlug: string;
  onRename: (id: Id<'documents'>, nextTitle: string) => Promise<void>;
  onDelete: (id: Id<'documents'>) => Promise<void>;
}) {
  return (
    <div>
      {nodes.map((n) => (
        <TreeNodeRow
          key={String(n._id)}
          node={n}
          projectId={projectId}
          spaceSlug={spaceSlug}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function TreeNodeRow({
  node,
  projectId,
  spaceSlug,
  onRename,
  onDelete,
}: {
  node: TreeNode;
  projectId: Id<'projects'>;
  spaceSlug: string;
  onRename: (id: Id<'documents'>, nextTitle: string) => Promise<void>;
  onDelete: (id: Id<'documents'>) => Promise<void>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(node.title);
  const isGroup = node.type === 'group';

  async function commitRename() {
    if (!title.trim() || title.trim() === node.title) {
      setEditing(false);
      setTitle(node.title);
      return;
    }
    await onRename(node._id as Id<'documents'>, title.trim());
    setEditing(false);
  }

  return (
    <div className="my-0.5">
      <div className="group flex items-center justify-between rounded-md px-2 py-1">
        <div className="flex items-center gap-2">
          {editing ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => e.key === 'Enter' && commitRename()}
              className="h-7 w-44"
              autoFocus
            />
          ) : isGroup ? (
            <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              {node.title}
            </span>
          ) : (
            <button
              onClick={() =>
                router.push(`/dashboard/${projectId}/spaces/${spaceSlug}/doc/${node._id}`)
              }
              className="text-left text-sm hover:underline"
            >
              {node.title}
            </button>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="invisible h-6 w-6 group-hover:visible">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {!isGroup && (
              <DropdownMenuItem
                onClick={() =>
                  router.push(`/dashboard/${projectId}/spaces/${spaceSlug}/doc/${node._id}`)
                }
              >
                Open
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <Pencil className="mr-2 h-4 w-4" /> Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                try {
                  await onDelete(node._id as Id<'documents'>);
                } catch (e) {
                  toast.error(getErrorMessage(e));
                }
              }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* children */}
      {!!node.children?.length && (
        <div className="pl-4">
          {node.children.map((c) => (
            <TreeNodeRow
              key={String(c._id)}
              node={c}
              projectId={projectId}
              spaceSlug={spaceSlug}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Optimistic helpers for nested trees ---------- */

function findNode(nodes: TreeNode[], id: Id<'documents'>): TreeNode | null {
  for (const n of nodes) {
    if (String(n._id) === String(id)) return n;
    if (n.children?.length) {
      const hit = findNode(n.children, id);
      if (hit) return hit;
    }
  }
  return null;
}

function insertChild(nodes: TreeNode[], parentId: Id<'documents'>, child: TreeNode): TreeNode[] {
  return nodes.map((n) => {
    if (String(n._id) === String(parentId)) {
      const nextChildren = [...(n.children ?? []), child];
      return { ...n, children: nextChildren };
    }
    if (n.children?.length) {
      return { ...n, children: insertChild(n.children, parentId, child) };
    }
    return n;
  });
}

function mapNodes(nodes: TreeNode[], map: (n: TreeNode) => TreeNode): TreeNode[] {
  return nodes.map((n) => {
    const mapped = map(n);
    if (mapped.children?.length) {
      return { ...mapped, children: mapNodes(mapped.children, map) };
    }
    return mapped;
  });
}

function removeNode(nodes: TreeNode[], id: Id<'documents'>): TreeNode[] {
  const filtered = nodes
    .filter((n) => String(n._id) !== String(id))
    .map((n) => (n.children?.length ? { ...n, children: removeNode(n.children, id) } : n));
  return filtered;
}
