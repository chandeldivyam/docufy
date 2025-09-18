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

  const { data: docs } = useLiveQuery(
    (q) => q.from({ docs: docsCollection }),
    [docsCollection]
  )

  if (!space)
    return <div className="p-8 text-muted-foreground">Space not found</div>

  return (
    <div className="grid grid-cols-[260px_1fr] h-full">
      <aside className="border-r bg-background p-2">
        <DocumentsTree
          key={spaceId}
          orgSlug={orgSlug}
          spaceId={spaceId}
          orgId={orgId!}
          docs={docs ?? []}
          docsCollection={docsCollection}
        />
      </aside>

      <section className="min-w-0">
        <header className="border-b p-4">
          <h1 className="text-2xl font-semibold">{space.name}</h1>
          <p className="text-sm text-muted-foreground">
            /{orgSlug}/spaces/{space.slug}
          </p>
        </header>
        <div className="p-4">
          <Outlet />
        </div>
      </section>
    </div>
  )
}

/** ---------- New Notion-like tree ---------- **/

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

  // Build parent -> children map
  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, DocumentRow[]>()
    for (const d of docs) {
      if (d.archived_at) continue
      const k = d.parent_id
      const list = map.get(k) ?? []
      list.push(d)
      map.set(k, list)
    }
    // sort by rank per group
    for (const list of map.values()) {
      list.sort(byRank)
    }
    return map
  }, [docs])

  const rootNodes = childrenByParent.get(null) ?? []

  // Expanded state for groups & pages-with-children. Persist by space.
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

  function toggle(id: string) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }))
  }

  // Title inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")

  async function startCreate({
    type,
    parentId = null,
    open = true,
  }: {
    type: "page" | "group"
    parentId?: string | null
    open?: boolean
  }) {
    const now = new Date()
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}`
    await docsCollection.insert({
      id,
      organization_id: orgId, // validated on server
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

    // Ensure parent shows its child
    if (parentId) {
      setExpanded((e) => ({ ...e, [parentId]: true }))
    }

    // Focus rename
    setEditingId(id)
    setEditTitle("Untitled")

    // Optionally open the page
    if (open && type === "page") {
      navigate({
        to: "/$orgSlug/spaces/$spaceId/document/$docId",
        params: { orgSlug, spaceId, docId: id },
      })
    }
  }

  async function commitRename(docId: string, title: string) {
    if (!title.trim()) return // keep previous
    try {
      await docsCollection.update(docId, (draft) => {
        draft.title = title.trim()
      })
    } finally {
      setEditingId(null)
      setEditTitle("")
    }
  }

  async function updateIcon(docId: string, icon: string | null) {
    await docsCollection.update(docId, (draft) => {
      draft.icon_name = icon
    })
  }

  async function deleteDoc(docId: string) {
    await docsCollection.delete(docId)
  }

  return (
    <div className="space-y-2">
      {/* Header with quick actions */}
      <div className="flex items-center justify-between px-2 pt-1">
        <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
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

      {/* Tree */}
      {rootNodes.length === 0 ? (
        <div className="px-2 py-3 text-muted-foreground text-sm">
          No documents yet
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
  setEditTitle: (t: string) => void
  onUpdateIcon: (id: string, icon: string | null) => void
  onDelete: (id: string) => void
  orgSlug: string
  spaceId: string
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
  } = props

  const children = childrenByParent.get(node.id) ?? []
  const hasChildren = children.length > 0
  const isGroup = node.type === "group"
  const isEditing = editingId === node.id

  // Focus management for inline rename
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
          "group flex items-center gap-1 rounded px-2 py-1 text-sm",
          isActive && "bg-accent text-accent-foreground"
        )}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        {/* Disclosure */}
        {hasChildren || isGroup ? (
          <button
            className="h-5 w-5 grid place-items-center rounded hover:bg-accent/50"
            onClick={() => onToggle(node.id)}
            title={expanded[node.id] ? "Collapse" : "Expand"}
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

        {/* Icon - clickable picker */}
        <IconPickerButton
          current={node.icon_name}
          fallback={isGroup ? "folder" : "file-text"}
          onChange={(name) => onUpdateIcon(node.id, name)}
          onClear={() => onUpdateIcon(node.id, null)}
        />

        {/* Title: link or inline editor */}
        {isEditing ? (
          <input
            ref={inputRef}
            className="min-w-0 flex-1 bg-transparent outline-none border rounded px-1 py-0.5"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommitRename(node.id, editTitle)
              if (e.key === "Escape") onCommitRename(node.id, node.title)
            }}
            onBlur={() => onCommitRename(node.id, editTitle)}
          />
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

        {/* Row actions */}
        <div className="ml-auto flex items-center gap-1">
          {/* Add child page */}
          <Button
            variant="ghost"
            size="icon"
            className="invisible h-6 w-6 group-hover:visible"
            title="Add child page"
            onClick={(e) => {
              e.stopPropagation()
              onStartCreate({ type: "page", parentId: node.id })
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>

          {/* Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="invisible h-6 w-6 group-hover:visible"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault()
                  onStartRename(node.id, node.title)
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault()
                  onStartCreate({ type: "page", parentId: node.id })
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add child page
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={async (e) => {
                  e.preventDefault()
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

      {/* Children */}
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
