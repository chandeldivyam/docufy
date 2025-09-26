import {
  createFileRoute,
  Outlet,
  Navigate,
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import {
  Building2,
  ChevronDown,
  Home as HomeIcon,
  LogOut,
  Menu,
  Settings as SettingsIcon,
  Users,
  Plus,
} from "lucide-react"
import { useLiveQuery } from "@tanstack/react-db"
import {
  getOrgSpacesCollection,
  emptySpacesCollection,
  myOrganizationsCollection,
  slugify as slugifySpace,
  type SpaceRow,
  getOrgSitesCollection,
  emptySitesCollection,
} from "@/lib/collections"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ThemeToggle } from "@/components/theme-toggle"
import { DynamicIcon } from "lucide-react/dynamic"
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { IconPickerGrid } from "@/components/icons/icon-picker"
import { type IconName } from "lucide-react/dynamic"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { CommandPalette } from "@/components/command-palette"

export const Route = createFileRoute("/_authenticated/$orgSlug")({
  ssr: false,
  loader: async () => {
    await Promise.all([myOrganizationsCollection.preload()])
    return null
  },
  component: OrgSlugLayout,
})

function OrgSlugLayout() {
  const { orgSlug } = Route.useParams()
  const { data: session, isPending: sPending } = authClient.useSession()
  const { data: activeOrg } = authClient.useActiveOrganization()
  const routerState = useRouterState()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // All orgs for validation + switcher
  const { data: myOrgs } = useLiveQuery((q) =>
    q.from({ myOrganizations: myOrganizationsCollection })
  )

  const current = useMemo(
    () => myOrgs?.find((o) => o.org_slug === orgSlug),
    [myOrgs, orgSlug]
  )

  // If user is allowed for this org, ensure it is the active org
  useEffect(() => {
    if (!current) return
    if (activeOrg?.id !== current.organization_id) {
      authClient.organization.setActive({
        organizationId: current.organization_id,
      })
    }
  }, [activeOrg?.id, current])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [routerState.location.pathname])

  if (sPending || myOrgs === undefined)
    return <div className="p-8 text-muted-foreground">Loading…</div>
  if (!session) return <Navigate to="/login" replace />
  if (!current) return <Navigate to="/orgs" replace />

  return (
    <div className="grid h-[100svh] grid-cols-1 md:grid-cols-[260px_1fr] overflow-hidden">
      {/* Sidebar - desktop */}
      <aside className="border-r bg-background hidden h-full min-h-0 md:flex md:flex-col overflow-hidden">
        <MainNavContent orgSlug={orgSlug} />
      </aside>

      {/* Main */}
      <main className="min-w-0 min-h-0 flex flex-col overflow-hidden">
        <CommandPalette orgSlug={orgSlug} />
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur md:hidden">
          <div className="flex items-center gap-2 p-2">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open navigation"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[85vw] max-w-sm p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Workspace navigation</SheetTitle>
                  <SheetDescription>
                    Select a destination or manage spaces.
                  </SheetDescription>
                </SheetHeader>
                <MainNavContent orgSlug={orgSlug} />
              </SheetContent>
            </Sheet>
            <span className="truncate font-medium">
              {current?.org_name ?? "Workspace"}
            </span>
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-1 md:p-4">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function MainNavContent({ orgSlug }: { orgSlug: string }) {
  const routerState = useRouterState()

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-14 flex-shrink-0 items-center gap-2 border-b px-3">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <OrgSwitcher currentSlug={orgSlug} />
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto">
        <nav className="space-y-1 p-2">
          <NavItem
            to="/$orgSlug"
            params={{ orgSlug }}
            icon={<HomeIcon className="h-4 w-4" />}
            isActive={routerState.location.pathname === `/${orgSlug}`}
          >
            Home
          </NavItem>
          <NavItem
            to="/$orgSlug/settings"
            params={{ orgSlug }}
            icon={<SettingsIcon className="h-4 w-4" />}
            isActive={routerState.location.pathname === `/${orgSlug}/settings`}
          >
            Settings
          </NavItem>
        </nav>

        <div className="px-2 py-3">
          <SitesSection currentSlug={orgSlug} />
        </div>

        <div className="px-2 py-3">
          <SpacesSection currentSlug={orgSlug} />
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 space-y-2 border-t p-2">
        <div className="flex items-center justify-between px-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => authClient.signOut()}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  )
}

function OrgSwitcher({ currentSlug }: { currentSlug: string }) {
  const navigate = useNavigate()
  const { data: myOrgs } = useLiveQuery((q) =>
    q.from({ myOrganizations: myOrganizationsCollection })
  )

  const items = useMemo(
    () =>
      (myOrgs ?? []).map((o) => ({
        id: o.organization_id,
        name: o.org_name,
        slug: o.org_slug,
      })),
    [myOrgs]
  )

  const active = items.find((o) => o.slug === currentSlug)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" className="gap-1">
          <span className="truncate max-w-[130px] text-left">
            {active?.name ?? "Workspace"}
          </span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {items.map((org) => (
          <DropdownMenuItem
            key={org.id}
            className={cn(
              "flex items-center gap-2",
              org.slug === currentSlug && "font-medium"
            )}
            onClick={async () => {
              await authClient.organization.setActive({
                organizationId: org.id,
              })
              navigate({
                to: "/$orgSlug",
                params: { orgSlug: org.slug ?? org.id },
              })
            }}
          >
            <Users className="h-4 w-4" />
            <div className="flex flex-col">
              <span>{org.name}</span>
              <span className="text-xs text-muted-foreground">{org.slug}</span>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/orgs" })}>
          <Plus className="mr-2 h-4 w-4" />
          Create or join workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NavItem({
  to,
  params,
  icon,
  children,
  isActive,
}: {
  to: "/$orgSlug" | "/$orgSlug/settings"
  params: { orgSlug: string }
  icon: React.ReactNode
  children: React.ReactNode
  isActive?: boolean
}) {
  return (
    <Link
      to={to}
      params={params}
      className={cn(
        "flex items-center gap-2 rounded px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
        isActive && "bg-accent text-accent-foreground"
      )}
    >
      {icon}
      <span>{children}</span>
    </Link>
  )
}

function SpacesSection({ currentSlug }: { currentSlug: string }) {
  // Resolve orgId for current slug
  const navigate = useNavigate()
  const routerState = useRouterState()
  const pathname = routerState.location.pathname

  const { data: myOrgs } = useLiveQuery((q) =>
    q.from({ myOrganizations: myOrganizationsCollection })
  )
  const orgId = myOrgs?.find((o) => o.org_slug === currentSlug)?.organization_id

  // Use org-scoped Electric shape
  const spacesCollection = orgId
    ? getOrgSpacesCollection(orgId)
    : emptySpacesCollection
  const { data: spaces } = useLiveQuery(
    (q) => q.from({ spaces: spacesCollection }),
    [spacesCollection]
  )

  // Create-space dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [iconName, setIconName] = useState<string>("file-text")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState<string>("")
  const [editIcon, setEditIcon] = useState<string>("file-text")

  // Delete dialog state
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function createSpace(e: React.FormEvent) {
    e.preventDefault()
    if (!orgId || !name.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const now = new Date()
      const spaceId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}`

      await spacesCollection.insert({
        id: spaceId,
        organization_id: orgId,
        name: name.trim(),
        slug: slugifySpace(name),
        description: description ? description : null,
        icon_name: iconName || null,
        created_at: now,
        updated_at: now,
      })
      setCreateOpen(false)
      setName("")
      setDescription("")
      setIconName("file-text")
      navigate({
        to: "/$orgSlug/spaces/$spaceId",
        params: { orgSlug: currentSlug, spaceId },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create space")
    } finally {
      setSubmitting(false)
    }
  }

  function openEdit(s: SpaceRow) {
    setEditId(s.id)
    setEditName(s.name)
    setEditDescription(s.description ?? "")
    setEditIcon(s.icon_name ?? "file-text")
    setEditOpen(true)
  }

  async function saveEdit() {
    if (!editId) return
    await spacesCollection.update(editId, (draft) => {
      draft.name = editName.trim() || draft.name
      draft.description = editDescription ? editDescription : null
      draft.icon_name = editIcon || null
      draft.updated_at = new Date()
    })
    setEditOpen(false)
  }

  function openDelete(s: SpaceRow) {
    setDeleteId(s.id)
    setDeleteSlug(s.slug)
    setDeleteError(null)
    setDeleteOpen(true)
  }

  async function confirmDelete() {
    if (!deleteId) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await spacesCollection.delete(deleteId)
      setDeleteOpen(false)
      if (
        pathname.startsWith(`/${currentSlug}/spaces/${deleteId}`) ||
        (deleteSlug &&
          pathname.startsWith(`/${currentSlug}/spaces/${deleteSlug}`))
      ) {
        navigate({ to: "/$orgSlug", params: { orgSlug: currentSlug } })
      }
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
          Spaces
        </h3>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Plus className="h-3 w-3" />
              <span className="sr-only">Create space</span>
            </Button>
          </DialogTrigger>
          <DialogContent aria-label="Create space">
            <DialogHeader>
              <DialogTitle>Create space</DialogTitle>
              <DialogDescription>
                Create a new space to organize your documents.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={createSpace} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
                <div className="space-y-2">
                  <Label>Icon</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        type="button"
                        className="w-16 justify-center"
                      >
                        <DynamicIcon
                          name={(iconName as IconName) || "file-text"}
                          className="h-5 w-5"
                        />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-[420px] p-1"
                    >
                      <IconPickerGrid
                        onSelect={(n) => setIconName(n)}
                        onRemove={() => setIconName("file-text")}
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="space-name">Name</Label>
                  <Input
                    id="space-name"
                    placeholder="User Guide"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="space-desc">Description (optional)</Label>
                <Input
                  id="space-desc"
                  placeholder="Brief description for this space"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || !name.trim()}>
                  {submitting ? "Creating…" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {spaces && spaces.length > 0 ? (
        <ul className="space-y-1">
          {spaces.map((s) => (
            <li key={s.id} className="relative group">
              <Link
                to="/$orgSlug/spaces/$spaceId"
                params={{ orgSlug: currentSlug, spaceId: s.id }}
                className={cn(
                  "flex items-center gap-2 rounded px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                  pathname.startsWith(`/${currentSlug}/spaces/${s.id}`) &&
                    "bg-accent text-accent-foreground"
                )}
                title={s.name}
              >
                <DynamicIcon
                  name={(s.icon_name as IconName) || "file-text"}
                  className="h-4 w-4"
                />
                <span className="truncate">{s.name}</span>

                <div className="ml-auto">
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
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault()
                          openEdit(s)
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault()
                          openDelete(s)
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-2 py-3 text-muted-foreground text-sm">
          No spaces yet
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent aria-label="Edit space">
          <DialogHeader>
            <DialogTitle>Edit space</DialogTitle>
            <DialogDescription>Edit the space details</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
            <div className="space-y-2">
              <Label>Icon</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className="w-16 justify-center"
                  >
                    <DynamicIcon
                      name={(editIcon as IconName) || "file-text"}
                      className="h-5 w-5"
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[420px] p-1">
                  <IconPickerGrid
                    onSelect={(n) => setEditIcon(n)}
                    onRemove={() => setEditIcon("file-text")}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-space-name">Name</Label>
              <Input
                id="edit-space-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Space name"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-space-desc">Description</Label>
            <Input
              id="edit-space-desc"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Brief description"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={saveEdit}
              disabled={!editId || !editName.trim()}
            >
              Save changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent aria-label="Delete space">
          <DialogHeader>
            <DialogTitle>Delete space</DialogTitle>
            <DialogDescription>
              This will permanently delete the space. You can not undo this.
            </DialogDescription>
          </DialogHeader>
          <p
            id="delete-space-description"
            className="text-sm text-muted-foreground"
          >
            This will permanently delete the space. You can not undo this.
          </p>
          {deleteError ? (
            <p className="text-sm text-destructive">{deleteError}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SitesSection({ currentSlug }: { currentSlug: string }) {
  const navigate = useNavigate()
  const routerState = useRouterState()
  const pathname = routerState.location.pathname

  const { data: myOrgs } = useLiveQuery((q) =>
    q.from({ myOrganizations: myOrganizationsCollection })
  )
  const orgId = myOrgs?.find((o) => o.org_slug === currentSlug)?.organization_id

  const sitesCollection = orgId
    ? getOrgSitesCollection(orgId)
    : emptySitesCollection

  const { data: sites } = useLiveQuery(
    (q) => q.from({ sites: sitesCollection }),
    [sitesCollection]
  )

  // Create dialog state
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slugTouched, setSlugTouched] = useState(false)

  function slugify(input: string) {
    return input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "")
  }

  useEffect(() => {
    if (!slugTouched) {
      setSlug(name ? slugify(name) : "")
    }
  }, [name, slugTouched])

  async function createSite(e: React.FormEvent) {
    e.preventDefault()
    if (!orgId || !name.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const siteId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}`

      const blobStoreId = import.meta.env.VITE_PUBLIC_VERCEL_BLOB_STORE_ID ?? ""
      const blobStoreUrl =
        import.meta.env.VITE_PUBLIC_VERCEL_BLOB_BASE_URL ?? ""

      console.log(blobStoreId, blobStoreUrl)

      if (!blobStoreId || !blobStoreUrl) {
        throw new Error("Blob store ID or URL not found")
      }

      console.log("trying to insert site")

      await sitesCollection.insert({
        id: siteId,
        organization_id: orgId,
        name: name.trim(),
        slug: slug || slugify(name),
        base_url: blobStoreUrl,
        store_id: blobStoreId,
        primary_host: null,
        created_at: new Date(),
        updated_at: new Date(),
        last_build_id: null,
        last_published_at: null,
      })
      setOpen(false)
      setName("")
      setSlug("")
      navigate({
        to: "/$orgSlug/sites/$siteId",
        params: { orgSlug: currentSlug, siteId },
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create site")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
          Sites
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Plus className="h-3 w-3" />
              <span className="sr-only">Create site</span>
            </Button>
          </DialogTrigger>
          <DialogContent aria-label="Create site">
            <DialogHeader>
              <DialogTitle>Create site</DialogTitle>
              <DialogDescription>
                Publish selected spaces to a public site.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={createSite} className="space-y-3">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Slug</Label>
                <Input
                  value={slug}
                  disabled
                  onChange={(e) => {
                    const v = slugify(e.target.value)
                    setSlug(v)
                    setSlugTouched(v.length > 0) // if cleared, re-enable auto-sync
                  }}
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOpen(false)
                    setName("")
                    setSlug("")
                    setSlugTouched(false)
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || !name}>
                  {submitting ? "Creating…" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {sites && sites.length > 0 ? (
        <ul className="space-y-1">
          {sites.map((s) => (
            <li key={s.id}>
              <Link
                to="/$orgSlug/sites/$siteId"
                params={{ orgSlug: currentSlug, siteId: s.id }}
                className={cn(
                  "flex items-center gap-2 rounded px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                  pathname.startsWith(`/${currentSlug}/sites/${s.id}`) &&
                    "bg-accent text-accent-foreground"
                )}
                title={s.name}
              >
                <span className="truncate">{s.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-2 py-3 text-muted-foreground text-sm">
          No sites yet
        </div>
      )}
    </div>
  )
}
