// apps/web/src/routes/_authenticated/$orgSlug/spaces/$spaceId.tsx
import {
  createFileRoute,
  Outlet,
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router"
import { useLiveQuery } from "@tanstack/react-db"
import {
  myOrganizationsCollection,
  getOrgSpacesCollection,
  emptySpacesCollection,
  getSpaceDocumentsCollection,
  type DocumentRow,
} from "@/lib/collections"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Plus,
  Trash2,
  Folder,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Pencil,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DynamicIcon } from "lucide-react/dynamic"
import type { IconName } from "lucide-react/dynamic"
import { IconPickerGrid } from "@/components/icons/icon-picker"
import { rankBetween } from "@/lib/rank"
import { toast } from "sonner"

export const Route = createFileRoute(
  "/_authenticated/$orgSlug/spaces/$spaceId"
)({
  ssr: false,
  loader: async ({ params }) => {
    await getSpaceDocumentsCollection(params.spaceId).preload()
    return null
  },
  component: SpacePage,
})

function SpacePage() {
  const { orgSlug, spaceId } = Route.useParams()
  const navigate = useNavigate()
  const routerState = useRouterState()
  const [mobileDocsOpen, setMobileDocsOpen] = useState(false)

  // Map slug -> orgId from cached org list
  const { data: myOrgs } = useLiveQuery((q) =>
    q.from({ myOrganizations: myOrganizationsCollection })
  )
  const orgId = myOrgs?.find((o) => o.org_slug === orgSlug)?.organization_id

  // Org-scoped spaces
  const spacesCollection = orgId
    ? getOrgSpacesCollection(orgId)
    : emptySpacesCollection
  const { data: spaces } = useLiveQuery((q) =>
    q.from({ spaces: spacesCollection })
  )
  const space = spaces?.find((s) => s.id === spaceId)

  // Space-scoped documents
  const docsCollection = useMemo(
    () => getSpaceDocumentsCollection(spaceId),
    [spaceId]
  )

  useEffect(() => {
    // make sure we’ve (re)hydrated the new shape
    docsCollection.preload?.()
  }, [docsCollection])

  useEffect(() => {
    setMobileDocsOpen(false)
  }, [routerState.location.pathname])

  const { data: docs } = useLiveQuery(
    (q) => q.from({ docs: docsCollection }),
    [docsCollection]
  )

  async function createTopLevelPage() {
    if (!orgId) return
    const now = new Date()
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}`

    await docsCollection.insert({
      id,
      organization_id: orgId,
      space_id: spaceId,
      parent_id: null,
      slug: "pending",
      title: "Untitled",
      icon_name: null,
      rank: "pending",
      type: "page",
      archived_at: null,
      created_at: now,
      updated_at: now,
    })

    navigate({
      to: "/$orgSlug/spaces/$spaceId/document/$docId",
      params: { orgSlug, spaceId, docId: id },
    })
  }

  if (!space)
    return <div className="p-8 text-muted-foreground">Space not found</div>

  return (
    <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[280px_1fr] overflow-hidden">
      <aside className="hidden h-full min-h-0 overflow-y-auto border-r bg-background p-2 md:block">
        <DocumentsTree
          key={spaceId}
          orgSlug={orgSlug}
          spaceId={spaceId}
          orgId={orgId!}
          docs={docs ?? []}
          docsCollection={docsCollection}
        />
      </aside>

      <section className="min-w-0 min-h-0 flex flex-col overflow-hidden">
        <div className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur md:hidden">
          <div className="flex items-center gap-2 px-2 py-2">
            <Sheet open={mobileDocsOpen} onOpenChange={setMobileDocsOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Folder className="h-4 w-4" />
                  Docs
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[90vw] max-w-[420px] p-2 overflow-y-auto"
              >
                <SheetHeader className="sr-only">
                  <SheetTitle>Document navigation</SheetTitle>
                  <SheetDescription>
                    Browse and open pages in this space.
                  </SheetDescription>
                </SheetHeader>
                <DocumentsTree
                  key={`sheet:${spaceId}`}
                  orgSlug={orgSlug}
                  spaceId={spaceId}
                  orgId={orgId!}
                  docs={docs ?? []}
                  docsCollection={docsCollection}
                />
              </SheetContent>
            </Sheet>
            <div className="ml-auto">
              <Button
                variant="default"
                size="sm"
                className="gap-2"
                onClick={createTopLevelPage}
              >
                <Plus className="h-4 w-4" />
                New page
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-1 md:p-4">
          <Outlet />
        </div>
      </section>
    </div>
  )
}

/** ---------- Responsive document tree ---------- **/

type DocumentsCollection = ReturnType<typeof getSpaceDocumentsCollection>

function DocumentsTree({
  orgSlug,
  spaceId,
  orgId,
  docs,
  docsCollection,
}: {
  orgSlug: string
  spaceId: string
  orgId: string
  docs: DocumentRow[]
  docsCollection: DocumentsCollection
}) {
  const navigate = useNavigate()
  const routerState = useRouterState()
  const pathname = routerState.location.pathname

  const [query, setQuery] = useState("")

  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined") return

    const mediaQuery = window.matchMedia("(pointer: coarse)")
    const updateFromMedia = () => setIsTouch(mediaQuery.matches)
    updateFromMedia()

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        setIsTouch(true)
      } else {
        setIsTouch(false)
      }
    }

    mediaQuery.addEventListener?.("change", updateFromMedia)
    window.addEventListener("pointerdown", handlePointerDown)

    return () => {
      mediaQuery.removeEventListener?.("change", updateFromMedia)
      window.removeEventListener("pointerdown", handlePointerDown)
    }
  }, [])

  const lowerTitleById = useMemo(() => {
    const map = new Map<string, string>()
    for (const doc of docs) {
      map.set(doc.id, (doc.title || "").toLowerCase())
    }
    return map
  }, [docs])

  const parentById = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const doc of docs) {
      map.set(doc.id, doc.parent_id)
    }
    return map
  }, [docs])

  const typeById = useMemo(() => {
    const map = new Map<string, DocumentRow["type"]>()
    for (const doc of docs) {
      map.set(doc.id, doc.type)
    }
    return map
  }, [docs])

  const visibleIds = useMemo(() => {
    if (!query.trim()) return new Set(docs.map((doc) => doc.id))
    const q = query.trim().toLowerCase()
    const matches = new Set<string>()
    for (const doc of docs) {
      if (doc.archived_at) continue
      if ((lowerTitleById.get(doc.id) || "").includes(q)) {
        matches.add(doc.id)
      }
    }
    const withAncestors = new Set<string>(matches)
    for (const id of matches) {
      let current = parentById.get(id) ?? null
      while (current) {
        withAncestors.add(current)
        current = parentById.get(current) ?? null
      }
    }
    return withAncestors
  }, [docs, lowerTitleById, parentById, query])

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, DocumentRow[]>()
    for (const doc of docs) {
      if (doc.archived_at) continue
      if (!visibleIds.has(doc.id)) continue
      const list = map.get(doc.parent_id) ?? []
      list.push(doc)
      map.set(doc.parent_id, list)
    }
    for (const list of map.values()) list.sort(byRank)
    return map
  }, [docs, visibleIds])

  const rootNodes = childrenByParent.get(null) ?? []

  const siblings = (parentId: string | null, excludeId?: string) => {
    const list = (childrenByParent.get(parentId) ?? []).filter(
      (doc) => doc.id !== excludeId
    )
    list.sort(byRank)
    return list
  }

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<{
    id: string
    mode: "before" | "after" | "inside"
  } | null>(null)

  const isAncestor = (ancestorId: string, candidateChildId: string) => {
    let current = parentById.get(candidateChildId) ?? null
    while (current) {
      if (current === ancestorId) return true
      current = parentById.get(current) ?? null
    }
    return false
  }

  const move = async (
    docId: string,
    newParentId: string | null,
    indexHint?: { beforeId?: string; afterId?: string }
  ) => {
    const docType = typeById.get(docId)
    if (docType === "group" && newParentId !== null) {
      toast.error("Groups can only live at the top level")
      return
    }

    const list = siblings(newParentId, docId)
    const oldParentId = parentById.get(docId) ?? null
    if (oldParentId === newParentId) {
      const beforeIdx = indexHint?.beforeId
        ? list.findIndex((doc) => doc.id === indexHint.beforeId)
        : -1
      const afterIdx = indexHint?.afterId
        ? list.findIndex((doc) => doc.id === indexHint.afterId)
        : -1
      if (beforeIdx === -1 && afterIdx === -1) return
    }

    let prevRank: string | null = null
    let nextRank: string | null = null
    if (indexHint?.beforeId) {
      const idx = list.findIndex((doc) => doc.id === indexHint.beforeId)
      nextRank = list[idx]?.rank ?? null
      prevRank = idx > 0 ? (list[idx - 1]?.rank ?? null) : null
    } else if (indexHint?.afterId) {
      const idx = list.findIndex((doc) => doc.id === indexHint.afterId)
      prevRank = list[idx]?.rank ?? null
      nextRank =
        idx >= 0 && idx + 1 < list.length ? (list[idx + 1]?.rank ?? null) : null
    } else {
      prevRank = list.length ? (list[list.length - 1]?.rank ?? null) : null
    }

    const newRank = rankBetween(prevRank, nextRank)
    await docsCollection.update(docId, (draft) => {
      draft.parent_id = newParentId
      draft.rank = newRank
      draft.updated_at = new Date()
    })
    if (newParentId) {
      setExpanded((prev) => ({ ...prev, [newParentId]: true }))
    }
  }

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const raw =
      typeof window !== "undefined"
        ? window.localStorage.getItem(`doc-tree:${spaceId}`)
        : null
    return raw ? JSON.parse(raw) : {}
  })

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        `doc-tree:${spaceId}`,
        JSON.stringify(expanded)
      )
    }
  }, [expanded, spaceId])

  const toggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")

  const startCreate = async ({
    type,
    parentId = null,
    open = true,
  }: {
    type: "page" | "group"
    parentId?: string | null
    open?: boolean
  }) => {
    const now = new Date()
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}`

    await docsCollection.insert({
      id,
      organization_id: orgId,
      space_id: spaceId,
      parent_id: parentId,
      slug: "pending",
      title: "Untitled",
      icon_name: null,
      rank: "pending",
      type,
      archived_at: null,
      created_at: now,
      updated_at: now,
    })

    if (parentId) {
      setExpanded((prev) => ({ ...prev, [parentId]: true }))
    }

    setEditingId(id)
    setEditTitle("Untitled")

    if (open && type === "page") {
      navigate({
        to: "/$orgSlug/spaces/$spaceId/document/$docId",
        params: { orgSlug, spaceId, docId: id },
      })
    }
  }

  const commitRename = async (docId: string, title: string) => {
    if (!title.trim()) return
    try {
      await docsCollection.update(docId, (draft) => {
        draft.title = title.trim()
      })
    } finally {
      setEditingId(null)
      setEditTitle("")
    }
  }

  const updateIcon = async (docId: string, icon: string | null) => {
    await docsCollection.update(docId, (draft) => {
      draft.icon_name = icon
    })
  }

  const deleteDoc = async (docId: string) => {
    await docsCollection.delete(docId)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-2 pt-1">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Documents
        </h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="New page"
            onClick={() => startCreate({ type: "page", parentId: null })}
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="New group"
            onClick={() =>
              startCreate({ type: "group", parentId: null, open: false })
            }
          >
            <Folder className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="px-2">
        <input
          type="text"
          inputMode="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search docs"
          className="h-8 w-full rounded-md border bg-background px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Search documents"
        />
      </div>

      {rootNodes.length === 0 ? (
        <div className="px-2 py-3 text-sm text-muted-foreground">
          {query ? "No matches" : "No documents yet"}
        </div>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {rootNodes.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              isActive={pathname.includes(`/document/${node.id}`)}
              childrenByParent={childrenByParent}
              expanded={expanded}
              onToggle={toggle}
              onStartCreate={startCreate}
              onStartRename={(id, currentTitle) => {
                setEditingId(id)
                setEditTitle(currentTitle)
              }}
              onCommitRename={commitRename}
              editingId={editingId}
              editTitle={editTitle}
              setEditTitle={setEditTitle}
              onUpdateIcon={updateIcon}
              onDelete={deleteDoc}
              orgSlug={orgSlug}
              spaceId={spaceId}
              draggingId={draggingId}
              setDraggingId={setDraggingId}
              dragOver={dragOver}
              setDragOver={setDragOver}
              isInvalidDrop={(targetId, mode) => {
                if (isTouch) return true
                if (!draggingId) return true
                if (targetId === draggingId) return true
                const effectiveParentId =
                  mode === "inside"
                    ? targetId
                    : (parentById.get(targetId) ?? null)
                if (effectiveParentId === draggingId) return true
                if (
                  effectiveParentId &&
                  isAncestor(draggingId, effectiveParentId)
                ) {
                  return true
                }
                return false
              }}
              onPerformDrop={async (target, mode) => {
                if (isTouch) return
                if (!draggingId) return
                if (mode === "inside") {
                  await move(draggingId, target.id)
                } else if (mode === "before") {
                  await move(draggingId, target.parent_id, {
                    beforeId: target.id,
                  })
                } else {
                  await move(draggingId, target.parent_id, {
                    afterId: target.id,
                  })
                }
                setDraggingId(null)
                setDragOver(null)
              }}
              canDrag={!isTouch}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function TreeNode(props: {
  node: DocumentRow
  depth: number
  isActive: boolean
  childrenByParent: Map<string | null, DocumentRow[]>
  expanded: Record<string, boolean>
  onToggle: (id: string) => void
  onStartCreate: (args: {
    type: "page" | "group"
    parentId?: string | null
    open?: boolean
  }) => void
  onStartRename: (id: string, currentTitle: string) => void
  onCommitRename: (id: string, title: string) => void
  editingId: string | null
  editTitle: string
  setEditTitle: (value: string) => void
  onUpdateIcon: (id: string, icon: string | null) => void
  onDelete: (id: string) => void
  orgSlug: string
  spaceId: string
  draggingId: string | null
  setDraggingId: (value: string | null) => void
  dragOver: { id: string; mode: "before" | "after" | "inside" } | null
  setDragOver: (
    value: { id: string; mode: "before" | "after" | "inside" } | null
  ) => void
  isInvalidDrop: (
    targetId: string,
    mode: "before" | "after" | "inside"
  ) => boolean
  onPerformDrop: (
    target: DocumentRow,
    mode: "before" | "after" | "inside"
  ) => void
  canDrag: boolean
}) {
  const {
    node,
    depth,
    isActive,
    childrenByParent,
    expanded,
    onToggle,
    onStartCreate,
    onStartRename,
    onCommitRename,
    editingId,
    editTitle,
    setEditTitle,
    onUpdateIcon,
    onDelete,
    orgSlug,
    spaceId,
    draggingId,
    setDraggingId,
    dragOver,
    setDragOver,
    isInvalidDrop,
    onPerformDrop,
    canDrag,
  } = props

  const children = childrenByParent.get(node.id) ?? []
  const hasChildren = children.length > 0
  const isGroup = node.type === "group"
  const isEditing = editingId === node.id
  const isDragOverHere = dragOver?.id === node.id
  const dragMode = dragOver?.mode
  const showInsideHighlight =
    isDragOverHere && dragMode === "inside" && !isInvalidDrop(node.id, "inside")

  const inputRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  return (
    <li>
      <div
        className={cn(
          "group relative flex items-center gap-1 rounded px-2 py-1 text-sm",
          isActive && "bg-accent text-accent-foreground",
          showInsideHighlight && "bg-primary/5 ring-1 ring-primary/40"
        )}
        style={{ paddingLeft: 8 + depth * 12 }}
        draggable={canDrag}
        onDragStart={(event) => {
          if (!canDrag) return
          event.dataTransfer.effectAllowed = "move"
          try {
            event.dataTransfer.setData("text/plain", node.id)
          } catch (_error) {
            // Some environments disallow custom drag data; ignore gracefully
          }
          setDraggingId(node.id)
        }}
        onDragEnd={() => {
          if (!canDrag) return
          setDraggingId(null)
          setDragOver(null)
        }}
        onDragOver={(event) => {
          if (!canDrag) return
          if (!draggingId || draggingId === node.id) return
          event.preventDefault()
          const rect = (
            event.currentTarget as HTMLDivElement
          ).getBoundingClientRect()
          const y = event.clientY - rect.top
          const threshold = rect.height * 0.25
          const mode: "before" | "after" | "inside" =
            y < threshold
              ? "before"
              : y > rect.height - threshold
                ? "after"
                : "inside"
          if (isInvalidDrop(node.id, mode)) {
            setDragOver(null)
          } else {
            setDragOver({ id: node.id, mode })
          }
        }}
        onDragLeave={(event) => {
          if (!canDrag) return
          const related = event.relatedTarget as Node | null
          if (!event.currentTarget.contains(related)) {
            setDragOver(null)
          }
        }}
        onDrop={(event) => {
          if (!canDrag) return
          event.preventDefault()
          if (!dragOver || dragOver.id !== node.id) return
          if (!draggingId || draggingId === node.id) return
          if (isInvalidDrop(node.id, dragOver.mode)) return
          onPerformDrop(node, dragOver.mode)
        }}
      >
        {isDragOverHere && dragMode === "before" ? (
          <div
            className="pointer-events-none absolute left-0 right-0 top-0 h-[2px] bg-primary"
            style={{ left: 8 + depth * 12 }}
          />
        ) : null}
        {isDragOverHere && dragMode === "after" ? (
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] bg-primary"
            style={{ left: 8 + depth * 12 }}
          />
        ) : null}

        {hasChildren || isGroup ? (
          <button
            className="grid h-5 w-5 place-items-center rounded hover:bg-accent/50"
            onClick={() => onToggle(node.id)}
            title={expanded[node.id] ? "Collapse" : "Expand"}
            aria-expanded={!!expanded[node.id]}
          >
            {expanded[node.id] ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="h-5 w-5" />
        )}

        <IconPickerButton
          current={node.icon_name}
          fallback={isGroup ? "folder" : "file-text"}
          onChange={(name) => onUpdateIcon(node.id, name)}
          onClear={() => onUpdateIcon(node.id, null)}
        />

        {isEditing ? (
          <input
            ref={inputRef}
            className="min-w-0 flex-1 rounded border bg-transparent px-1 py-0.5 outline-none"
            value={editTitle}
            onChange={(event) => setEditTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onCommitRename(node.id, editTitle)
              if (event.key === "Escape") onCommitRename(node.id, node.title)
            }}
            onBlur={() => onCommitRename(node.id, editTitle)}
          />
        ) : isGroup ? (
          <span className="flex-1 truncate" title={node.title}>
            {node.title}
          </span>
        ) : (
          <Link
            to="/$orgSlug/spaces/$spaceId/document/$docId"
            params={{ orgSlug, spaceId, docId: node.id }}
            className={cn("flex-1 truncate")}
            title={node.title}
          >
            {node.title}
          </Link>
        )}

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="invisible h-6 w-6 group-hover:visible"
            title="Add child page"
            onClick={(event) => {
              event.stopPropagation()
              onStartCreate({ type: "page", parentId: node.id })
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="invisible h-6 w-6 group-hover:visible"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={(event) => {
                  event.preventDefault()
                  onStartRename(node.id, node.title)
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(event) => {
                  event.preventDefault()
                  onStartCreate({ type: "page", parentId: node.id })
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add child page
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async (event) => {
                  event.preventDefault()
                  if (node.type === "group" && children.length > 0) {
                    const ok = window.confirm(
                      "Delete this group? Its child pages will be moved to root."
                    )
                    if (!ok) return
                  } else {
                    const ok = window.confirm("Delete this page?")
                    if (!ok) return
                  }
                  await onDelete(node.id)
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {(children.length > 0 || isGroup) && expanded[node.id] ? (
        <ul className="space-y-0.5">
          {children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              isActive={location.pathname.includes(`/document/${child.id}`)}
              childrenByParent={childrenByParent}
              expanded={expanded}
              onToggle={onToggle}
              onStartCreate={onStartCreate}
              onStartRename={onStartRename}
              onCommitRename={onCommitRename}
              editingId={editingId}
              editTitle={editTitle}
              setEditTitle={setEditTitle}
              onUpdateIcon={onUpdateIcon}
              onDelete={onDelete}
              orgSlug={orgSlug}
              spaceId={spaceId}
              draggingId={draggingId}
              setDraggingId={setDraggingId}
              dragOver={dragOver}
              setDragOver={setDragOver}
              isInvalidDrop={isInvalidDrop}
              onPerformDrop={onPerformDrop}
              canDrag={canDrag}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

function IconPickerButton({
  current,
  fallback,
  onChange,
  onClear,
}: {
  current: string | null
  fallback: IconName
  onChange: (name: string) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="h-5 w-5 grid place-items-center rounded hover:bg-accent/50"
          title="Change icon"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
          }}
        >
          {current ? (
            <DynamicIcon
              name={(current as IconName) || fallback}
              className="h-4 w-4"
            />
          ) : (
            <DynamicIcon
              name={fallback}
              className="h-4 w-4 text-muted-foreground"
            />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[420px] p-1">
        <IconPickerGrid
          onSelect={(n) => {
            onChange(n)
            setOpen(false)
          }}
          onRemove={() => {
            onClear()
            setOpen(false)
          }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function byRank(a: { rank: string }, b: { rank: string }) {
  return a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0
}
