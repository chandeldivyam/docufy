'use client';

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
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
import {
  FileText,
  Folder,
  MoreHorizontal,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  GripVertical,
} from 'lucide-react';
import { toast } from 'sonner';

import { useQueryWithStatus } from '@/lib/convexHooks';
import { getErrorMessage, isAuthError } from '@/lib/errors';
import type { Id } from '@/convex/_generated/dataModel';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type CollisionDetection,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS as DndCSS } from '@dnd-kit/utilities';

/** Minimal shape expected from getTreeForSpace */
type BaseDocumentNode = {
  type: 'page' | 'group';
  title: string;
  slug: string;
  rank: string;
  parentId?: Id<'documents'>;
  isHidden: boolean;
  pmsDocKey?: string;
};

type DocumentNode = BaseDocumentNode & { _id: Id<'documents'> };
type TreeNode = DocumentNode & { children: TreeNode[] };

// Helper to detect optimistic placeholder IDs created by optimistic updates
const isOptimisticId = (id: unknown) => String(id).startsWith('optimistic:');

export function SpaceSidebar() {
  const params = useParams<{ projectId: string; spaceSlug: string }>();
  const projectId = params.projectId as unknown as Id<'projects'>;
  const spaceSlug = params.spaceSlug;

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
  const params = useParams<{ documentId?: string }>();

  const treeQuery = useQueryWithStatus(api.documents.getTreeForSpace, { spaceId });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  // Persist expanded state per space
  const storageKey = `sidebar-expanded:${String(spaceId)}`;
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = window.localStorage.getItem(storageKey);
      const list: string[] = raw ? JSON.parse(raw) : [];
      return new Set(list);
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(expanded)));
  }, [expanded, storageKey]);

  // Auto-expand ancestors of the active doc
  useEffect(() => {
    const activeId = params?.documentId;
    const tree = treeQuery.data;
    if (!activeId || !tree) return;

    const parents: string[] = [];
    const walk = (nodes: TreeNode[], trail: string[]) => {
      for (const n of nodes) {
        const nextTrail = [...trail, String(n._id)];
        if (String(n._id) === String(activeId)) {
          parents.push(...trail);
          return true;
        }
        if (n.children?.length && walk(n.children, nextTrail)) return true;
      }
      return false;
    };
    walk(tree, []);

    if (parents.length) {
      setExpanded((prev) => {
        const next = new Set(prev);
        parents.forEach((p) => next.add(p));
        return next;
      });
    }
  }, [params?.documentId, treeQuery.data]);

  // Mutations with optimistic tree updates
  const createDoc = useMutation(api.documents.createDocument).withOptimisticUpdate(
    (store, { spaceId: sid, type, title, parentId }) => {
      const current = store.getQuery(api.documents.getTreeForSpace, { spaceId: sid }) as
        | TreeNode[]
        | undefined;
      if (!current) return;

      const optimisticId = `optimistic:${Math.random().toString(36).slice(2)}`;
      const optimisticNode: TreeNode = {
        _id: optimisticId as Id<'documents'>,
        type,
        title,
        slug: title,
        rank: '~', // placeholder, server will return the real rank
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

  const moveDoc = useMutation(api.documents.moveDocument).withOptimisticUpdate(
    (store, { documentId, parentId, index }) => {
      const current = store.getQuery(api.documents.getTreeForSpace, { spaceId }) as
        | TreeNode[]
        | undefined;
      if (!current) return;
      const next = moveNode(
        current,
        String(documentId),
        parentId ? String(parentId) : undefined,
        index,
      );
      store.setQuery(api.documents.getTreeForSpace, { spaceId }, next);
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
      const created = await createDoc({ spaceId, type, title });
      if (type === 'page' && created?._id) {
        router.push(`/dashboard/${projectId}/spaces/${spaceSlug}/doc/${created._id}`);
      }
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  async function onCreateChild(parentId: Id<'documents'>) {
    try {
      const created = await createDoc({ spaceId, type: 'page', title: 'Untitled', parentId });
      setExpanded((prev) => new Set(prev).add(String(parentId)));
      if (created?._id) {
        router.push(`/dashboard/${projectId}/spaces/${spaceSlug}/doc/${created._id}`);
      }
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  // Prepare data + DnD local state BEFORE any early returns
  const tree = useMemo(() => treeQuery.data ?? [], [treeQuery.data]);

  // ---- DnD local state & projection helpers ----
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [placement, setPlacement] = useState<DropPlacement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const flat = useMemo(() => flattenTree(tree ?? []), [tree]);
  const activeFlat = activeId ? flat.find((n) => n.id === activeId) : undefined;
  const projected =
    activeId && overId && placement
      ? getProjectionWithPlacement(flat, activeId, overId, placement)
      : null;

  useEffect(() => {
    if (!activeId) return;
    const onMove = (e: PointerEvent) => setPointer({ x: e.clientX, y: e.clientY });
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [activeId]);

  const invalidDrop = useMemo(() => {
    if (!projected || !activeId) return false;
    const node = tree && findNode(tree, activeId as unknown as Id<'documents'>);
    if (!node) return false;
    const movingGroup = node.type === 'group';
    if (movingGroup && projected.parentId) return true;
    if (projected.parentId && isDescendant(tree, activeId, projected.parentId)) return true;
    if (projected.parentId && projected.parentId.startsWith('optimistic:')) return true;
    return false;
  }, [projected, activeId, tree]);

  // Auto-expand when hovering "inside" for ~500ms
  useEffect(() => {
    if (!overId || placement !== 'inside') return;
    const id = overId;
    const t = setTimeout(() => {
      setExpanded((prev) => new Set(prev).add(id));
    }, 500);
    return () => clearTimeout(t);
  }, [overId, placement, setExpanded]);

  const dropLineTop = useMemo<number | null>(() => {
    if (!scrollRef.current || !overId || !placement || placement === 'inside') return null;
    const row = getRowEl(scrollRef.current, overId);
    if (!row) return null;
    const containerRect = scrollRef.current.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const base = rowRect.top - containerRect.top + scrollRef.current.scrollTop;
    return placement === 'above' ? base : base + rowRect.height;
  }, [overId, placement]);

  const collisionWithoutActive: CollisionDetection = useCallback((args) => {
    const { active, droppableContainers } = args;
    const filtered = droppableContainers.filter((c) => c.id !== active.id);
    return closestCenter({ ...args, droppableContainers: filtered });
  }, []);

  if (treeQuery.isPending) {
    return (
      <div className="flex h-full flex-col">
        <div className="space-y-1 p-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-5 w-36" />
        </div>
        <AddRow onCreateTop={onCreateTop} />
      </div>
    );
  }

  if (treeQuery.isError && !isAuthError(treeQuery.error)) {
    return (
      <div className="p-3">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{getErrorMessage(treeQuery.error)}</AlertDescription>
        </Alert>
        <AddRow onCreateTop={onCreateTop} className="mt-2" />
      </div>
    );
  }

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    if (isOptimisticId(id)) return;
    setActiveId(id);
    setOverId(id);
    setOffsetX(0);
    setPlacement('inside');
  }

  function onDragOver(e: DragOverEvent) {
    if (!activeId) return;
    setOverId(e.over ? String(e.over.id) : null);
    setOffsetX(e?.delta?.x ?? 0);
    const oid = e.over ? String(e.over.id) : null;
    if (oid) {
      const pl = decidePlacement(scrollRef.current, flat, oid, pointer);
      setPlacement(pl);
    } else {
      setPlacement(null);
    }
  }

  async function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;

    if (!over || over === id) {
      setActiveId(null);
      setOverId(null);
      setOffsetX(0);
      setPointer(null);
      setPlacement(null);
      return;
    }
    const finalPlacement = over ? decidePlacement(scrollRef.current, flat, over, pointer) : null;
    const proj =
      over && finalPlacement ? getProjectionWithPlacement(flat, id, over, finalPlacement) : null;

    setActiveId(null);
    setOverId(null);
    setOffsetX(0);
    setPointer(null);
    setPlacement(null);

    if (!proj) return;
    if (proj.parentId && proj.parentId === id) {
      toast.error('Cannot nest a document under itself');
      return;
    }

    const node = tree && findNode(tree, id as unknown as Id<'documents'>);
    if (!node) return;
    const movingGroup = node.type === 'group';
    if (movingGroup && proj.parentId) return;
    if (proj.parentId && isDescendant(tree, id, proj.parentId)) return;
    if (proj.parentId && proj.parentId.startsWith('optimistic:')) return;

    try {
      await moveDoc({
        documentId: id as unknown as Id<'documents'>,
        parentId: proj.parentId ? (proj.parentId as unknown as Id<'documents'>) : undefined,
        index: proj.index,
      });
      if (proj.parentId) setExpanded((prev) => new Set(prev).add(proj.parentId!));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="relative flex-1 overflow-y-auto p-2">
        {tree.length === 0 ? (
          <div className="text-muted-foreground p-2 text-sm">No documents yet</div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={collisionWithoutActive}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDragCancel={() => {
              setActiveId(null);
              setOverId(null);
              setOffsetX(0);
            }}
          >
            <SortableContext items={flat.map((n) => n.id)} strategy={verticalListSortingStrategy}>
              <Tree
                nodes={tree}
                projectId={projectId}
                spaceSlug={spaceSlug}
                expanded={expanded}
                setExpanded={setExpanded}
                dropInsideTargetId={placement === 'inside' ? (overId ?? null) : null}
                invalidDrop={invalidDrop}
                onCreateChild={onCreateChild}
                onRename={async (id, nextTitle) => {
                  try {
                    await updateDoc({ documentId: id, title: nextTitle });
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
            </SortableContext>

            <DragOverlay>
              {activeFlat ? (
                <div
                  className="bg-card rounded-md border px-2 py-1 text-sm"
                  style={{ transform: `translateX(${offsetX}px)` }}
                >
                  {activeFlat.ref.title}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
        {dropLineTop !== null ? (
          <div
            className={`pointer-events-none absolute left-0 right-0 h-0.5 ${invalidDrop ? 'bg-destructive' : 'bg-primary'}`}
            style={{ top: dropLineTop }}
          />
        ) : null}
      </div>

      <AddRow onCreateTop={onCreateTop} />
    </div>
  );
}

/* ---------- Presentational bits ---------- */

function AddRow({
  onCreateTop,
  className = '',
}: {
  onCreateTop: (t: 'page' | 'group') => void;
  className?: string;
}) {
  return (
    <div className={`border-t px-2 py-2 ${className}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="w-full justify-start gap-2">
            <Plus className="h-4 w-4" />
            <span>Add new...</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
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
  expanded,
  setExpanded,
  dropInsideTargetId,
  invalidDrop,
  onCreateChild,
  onRename,
  onDelete,
}: {
  nodes: TreeNode[];
  projectId: Id<'projects'>;
  spaceSlug: string;
  expanded: Set<string>;
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
  dropInsideTargetId: string | null;
  invalidDrop: boolean;
  onCreateChild: (parentId: Id<'documents'>) => Promise<void>;
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
          expanded={expanded}
          setExpanded={setExpanded}
          isDropInsideTarget={dropInsideTargetId === n._id}
          invalidDrop={invalidDrop}
          onCreateChild={onCreateChild}
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
  expanded,
  setExpanded,
  isDropInsideTarget,
  invalidDrop,
  onCreateChild,
  onRename,
  onDelete,
}: {
  node: TreeNode;
  projectId: Id<'projects'>;
  spaceSlug: string;
  expanded: Set<string>;
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
  isDropInsideTarget: boolean;
  invalidDrop: boolean;
  onCreateChild: (parentId: Id<'documents'>) => Promise<void>;
  onRename: (id: Id<'documents'>, nextTitle: string) => Promise<void>;
  onDelete: (id: Id<'documents'>) => Promise<void>;
}) {
  const sortable = useSortable({ id: String(node._id), disabled: isOptimisticId(node._id) });
  const style = {
    transform: DndCSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };
  const router = useRouter();
  const params = useParams<{ documentId?: string }>();
  const active = params?.documentId && String(params.documentId) === String(node._id);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(node.title);

  const isGroup = node.type === 'group';
  const hasChildren = node.children?.length > 0;
  const isExpanded = expanded.has(String(node._id));
  const canNavigate = !isGroup && !editing && !isOptimisticId(node._id);

  function toggle() {
    if (!hasChildren) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      const key = String(node._id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function commitRename() {
    const next = title.trim();
    if (!next || next === node.title) {
      setEditing(false);
      setTitle(node.title);
      return;
    }
    await onRename(node._id as Id<'documents'>, next);
    setEditing(false);
  }

  return (
    <div className="my-0.5">
      <div
        ref={sortable.setNodeRef}
        style={style}
        {...sortable.attributes}
        data-node-id={String(node._id)}
        data-node-type={node.type}
        data-parent-id={node.parentId ? String(node.parentId) : ''}
        className={[
          'group flex items-center justify-between rounded-md px-2 py-1',
          active ? 'bg-muted/60' : 'hover:bg-muted/40',
          isDropInsideTarget && !invalidDrop ? 'ring-primary/60 bg-primary/5 ring-2' : '',
          isDropInsideTarget && invalidDrop ? 'ring-destructive/60 bg-destructive/5 ring-2' : '',
          canNavigate ? 'cursor-pointer' : '',
        ].join(' ')}
        onClick={() => {
          if (!canNavigate) return;
          router.push(`/dashboard/${projectId}/spaces/${spaceSlug}/doc/${node._id}`);
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {hasChildren ? (
            <button
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
              onClick={(e) => {
                e.stopPropagation();
                toggle();
              }}
              className="grid h-5 w-5 shrink-0 place-items-center"
            >
              {isExpanded ? (
                <ChevronDown className="text-muted-foreground h-4 w-4" />
              ) : (
                <ChevronRight className="text-muted-foreground h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}

          {/* Icon slot with hover drag-handle overlay */}
          <span className="relative grid h-5 w-5 shrink-0 place-items-center">
            <span className="transition-opacity duration-100 group-hover:opacity-0">
              {isGroup ? (
                <Folder className="text-muted-foreground h-4 w-4 shrink-0" />
              ) : (
                <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
              )}
            </span>
            <span
              className="absolute inset-0 grid cursor-grab touch-none select-none place-items-center opacity-0 transition-opacity duration-100 active:cursor-grabbing group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              {...sortable.listeners}
            >
              <GripVertical className="text-muted-foreground/70 h-3.5 w-3.5" />
            </span>
          </span>

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
            <button
              onClick={
                hasChildren
                  ? (e) => {
                      e.stopPropagation();
                      toggle();
                    }
                  : undefined
              }
              className={[
                'text-muted-foreground truncate text-xs font-semibold uppercase tracking-wide',
                hasChildren ? 'hover:text-foreground cursor-pointer' : '',
              ].join(' ')}
              title={node.title}
            >
              {node.title}
            </button>
          ) : (
            <button
              onClick={() => {
                if (isOptimisticId(node._id)) return;
                router.push(`/dashboard/${projectId}/spaces/${spaceSlug}/doc/${node._id}`);
              }}
              className={[
                'truncate text-left text-sm',
                isOptimisticId(node._id) ? 'pointer-events-none opacity-60' : '',
              ].join(' ')}
              title={node.title}
            >
              {isOptimisticId(node._id) ? 'Creating…' : node.title}
            </button>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="invisible h-6 w-6 group-hover:visible"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onCreateChild(node._id as Id<'documents'>)}>
              <Plus className="mr-2 h-4 w-4" /> Add child page
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <Pencil className="mr-2 h-4 w-4" /> Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                const ok = window.confirm('Delete this document and its children?');
                if (!ok) return;
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

      {node.children?.length && isExpanded ? (
        <div className="pl-4">
          {node.children.map((c) => (
            <TreeNodeRow
              key={String(c._id)}
              node={c}
              projectId={projectId}
              spaceSlug={spaceSlug}
              expanded={expanded}
              setExpanded={setExpanded}
              isDropInsideTarget={
                isDropInsideTarget && String(c._id) === String(node._id) ? true : isDropInsideTarget
              }
              invalidDrop={invalidDrop}
              onCreateChild={onCreateChild}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : null}
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

/* ---------- Flattened view + projection + move helpers ---------- */

type FlatNode = {
  id: string;
  ref: TreeNode;
  depth: number;
  parentId?: string;
};

const INDENT = 20; // px per level

function flattenTree(nodes: TreeNode[], depth = 0, parentId?: string): FlatNode[] {
  const out: FlatNode[] = [];
  for (const n of nodes) {
    out.push({ id: String(n._id), ref: n, depth, parentId });
    if (n.children?.length) {
      out.push(...flattenTree(n.children, depth + 1, String(n._id)));
    }
  }

  return out;
}

function isDescendant(tree: TreeNode[], parentId: string, childId: string): boolean {
  const parent = findNode(tree, parentId as Id<'documents'>);
  if (!parent) return false;
  const stack = [...(parent.children ?? [])];
  while (stack.length) {
    const cur = stack.pop()!;
    if (String(cur._id) === childId) return true;
    if (cur.children?.length) stack.push(...cur.children);
  }
  return false;
}

type DropPlacement = 'above' | 'below' | 'inside';

function cssEscapeSafe(s: string) {
  return globalThis.CSS?.escape
    ? globalThis.CSS.escape(s)
    : s.replace(/([ !"#$%&'()*+,./:;<=>?@[\]^`{|}~\\])/g, '\\$1');
}

function getRowEl(container: HTMLElement | null, id: string) {
  if (!container) return null;
  return container.querySelector(`[data-node-id="${cssEscapeSafe(id)}"]`) as HTMLElement | null;
}

function decidePlacement(
  container: HTMLElement | null,
  flat: FlatNode[],
  overId: string,
  pointer: { x: number; y: number } | null,
): DropPlacement {
  const el = getRowEl(container, overId);
  if (!el || !pointer) return 'inside';

  const rect = el.getBoundingClientRect();
  const topZone = rect.top + rect.height * 0.25;
  const bottomZone = rect.bottom - rect.height * 0.25;
  let placement: DropPlacement =
    pointer.y < topZone ? 'above' : pointer.y > bottomZone ? 'below' : 'inside';

  if (placement === 'inside') {
    const overFlat = flat.find((n) => n.id === overId);
    const depth = overFlat ? overFlat.depth : 0;
    const nestThresholdX = rect.left + 48 + (depth + 1) * INDENT;
    if (pointer.x < nestThresholdX) {
      const mid = rect.top + rect.height / 2;
      placement = pointer.y < mid ? 'above' : 'below';
    }
  }

  return placement;
}

function getProjectionWithPlacement(
  flat: FlatNode[],
  activeId: string,
  overId: string,
  placement: DropPlacement,
) {
  const over = flat.find((n) => n.id === overId);
  const active = flat.find((n) => n.id === activeId);
  if (!over || !active) return null;

  if (placement === 'inside') {
    return {
      depth: over.depth + 1,
      parentId: over.id,
      index: over.ref.children?.length ?? 0,
    };
  }

  const parentId = over.parentId;
  const siblings = flat.filter((n) => n.parentId === parentId && n.id !== activeId);
  const overIdx = siblings.findIndex((n) => n.id === overId);
  const baseIndex = overIdx === -1 ? siblings.length : overIdx;
  const index = placement === 'above' ? baseIndex : baseIndex + 1;

  return {
    depth: over.depth,
    parentId,
    index: Math.max(0, Math.min(index, siblings.length)),
  };
}

function detachNode(nodes: TreeNode[], id: string): { node?: TreeNode; rest: TreeNode[] } {
  let found: TreeNode | undefined;

  function walk(list: TreeNode[]): TreeNode[] {
    const out: TreeNode[] = [];
    for (const n of list) {
      if (String(n._id) === id) {
        found = n;
        continue;
      }
      const withChildren = n.children?.length ? { ...n, children: walk(n.children) } : n;
      out.push(withChildren);
    }
    return out;
  }

  const rest = walk(nodes);
  return { node: found, rest };
}

function insertNode(
  nodes: TreeNode[],
  parentId: string | undefined,
  node: TreeNode,
  index: number,
): TreeNode[] {
  if (!parentId) {
    const roots = [...nodes];
    roots.splice(index, 0, { ...node, parentId: undefined });
    return roots;
  }
  return nodes.map((n) => {
    if (String(n._id) === parentId) {
      const kids = [...(n.children ?? [])];
      kids.splice(index, 0, { ...node, parentId: n._id as Id<'documents'> });
      return { ...n, children: kids };
    }
    if (n.children?.length) {
      return { ...n, children: insertNode(n.children, parentId, node, index) };
    }
    return n;
  });
}

function moveNode(
  nodes: TreeNode[],
  id: string,
  parentId: string | undefined,
  index: number,
): TreeNode[] {
  const { node, rest } = detachNode(nodes, id);
  if (!node) return nodes;
  return insertNode(rest, parentId, node, index);
}
