import * as React from "react"
import {
  createFileRoute,
  Outlet,
  Navigate,
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"
import { useCallback, useEffect, useMemo, useState } from "react"
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
  getOrgGithubInstallationsCollection,
  emptyGithubInstallationsCollection,
  getGithubRepositoriesCollection,
  emptyGithubRepositoriesCollection,
  type GithubRepositoryRow,
} from "@/lib/collections"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ThemeToggle } from "@/components/theme-toggle"
import { DynamicIcon } from "lucide-react/dynamic"
import {
  CheckCircle2,
  GitBranch,
  Github,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CommandPalette } from "@/components/command-palette"
import { toast } from "sonner"
import { usePostHogIdentify } from "@/lib/use-posthog-identify"
import { usePostHog } from "posthog-js/react"

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

  usePostHogIdentify()

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
  const posthog = usePostHog()

  const handleLogout = () => {
    // Reset PostHog before signing out
    if (posthog) {
      posthog.reset()
    }
    authClient.signOut()
  }

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
            onClick={handleLogout}
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
    try {
      await spacesCollection.update(editId, (draft) => {
        const nextName = editName.trim()
        if (nextName) {
          draft.name = nextName
          // Keep slug in sync with name for now (no separate slug editor)
          draft.slug = slugifySpace(nextName)
        }
        draft.description = editDescription ? editDescription : null
        draft.icon_name = editIcon || null
        draft.updated_at = new Date()
      })
      setEditOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update space")
    }
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
  const org = myOrgs?.find((o) => o.org_slug === currentSlug)
  const orgId = org?.organization_id

  const sitesCollection = orgId
    ? getOrgSitesCollection(orgId)
    : emptySitesCollection

  const { data: sites } = useLiveQuery(
    (q) => q.from({ sites: sitesCollection }),
    [sitesCollection]
  )

  const installationsCollection = orgId
    ? getOrgGithubInstallationsCollection(orgId)
    : emptyGithubInstallationsCollection
  const { data: installations } = useLiveQuery(
    (q) => q.from({ installations: installationsCollection }),
    [installationsCollection]
  )
  const installation = installations?.[0] ?? null
  const installationId = installation?.id ?? null

  const reposCollection =
    installationId && orgId
      ? getGithubRepositoriesCollection(installationId)
      : emptyGithubRepositoriesCollection
  const { data: repos } = useLiveQuery(
    (q) => q.from({ repos: reposCollection }),
    [reposCollection]
  )

  // Create dialog state
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState<"studio" | "github">("studio")
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slugTouched, setSlugTouched] = useState(false)
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null)
  const [repoSearch, setRepoSearch] = useState("")
  const [branch, setBranch] = useState("")
  const [branchDirty, setBranchDirty] = useState(false)
  const [branchSuggestions, setBranchSuggestions] = useState<string[]>([])
  const [branchLoading, setBranchLoading] = useState(false)
  const [branchError, setBranchError] = useState<string | null>(null)
  const [configPath, setConfigPath] = useState("docufy.config.json")
  const [configStatus, setConfigStatus] = useState<
    "idle" | "checking" | "ok" | "error"
  >("idle")
  const [configMessage, setConfigMessage] = useState<string | null>(null)
  const [configPreview, setConfigPreview] = useState<string | null>(null)
  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false)

  const slugifyValue = useCallback((input: string) => {
    return input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "")
  }, [])

  useEffect(() => {
    if (!slugTouched) {
      setSlug(name ? slugifyValue(name) : "")
    }
  }, [name, slugTouched, slugifyValue])

  const selectedRepo: GithubRepositoryRow | null = useMemo(
    () => repos?.find((r) => String(r.id) === selectedRepoId) ?? null,
    [repos, selectedRepoId]
  )

  useEffect(() => {
    if (source !== "github" || !selectedRepo) return
    const repoName =
      selectedRepo.full_name.split("/").pop() ?? selectedRepo.full_name
    setName(repoName)
    if (!slugTouched) {
      setSlug(slugifyValue(repoName))
    }
    setBranch(selectedRepo.default_branch || "main")
    setBranchDirty(false)
  }, [selectedRepo, slugifyValue, slugTouched, source])

  useEffect(() => {
    setConfigStatus("idle")
    setConfigMessage(null)
    setConfigPreview(null)
  }, [branch, configPath, selectedRepoId, source])

  useEffect(() => {
    if (!open) {
      setSource("studio")
      setName("")
      setSlug("")
      setSlugTouched(false)
      setSelectedRepoId(null)
      setBranch("")
      setBranchDirty(false)
      setBranchSuggestions([])
      setBranchError(null)
      setConfigPath("docufy.config.json")
      setConfigStatus("idle")
      setConfigMessage(null)
      setConfigPreview(null)
      setError(null)
      setRepoSearch("")
      setRepoDropdownOpen(false)
    }
  }, [open])

  const loadBranches = useCallback(
    async (search?: string) => {
      if (
        source !== "github" ||
        !installationId ||
        !selectedRepo?.full_name ||
        !orgId
      ) {
        return
      }

      setBranchLoading(true)
      setBranchError(null)
      try {
        const params = new URLSearchParams({
          installationId,
          repo: selectedRepo.full_name,
          orgId,
        })
        if (selectedRepo.default_branch) {
          params.set("defaultBranch", selectedRepo.default_branch)
        }
        const trimmed = search?.trim()
        if (trimmed) params.set("q", trimmed)
        const res = await fetch(`/api/github/branches?${params.toString()}`)
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data?.error ?? "Failed to load branches")
        }
        setBranchSuggestions(data.branches ?? [])
      } catch (err) {
        setBranchSuggestions([])
        setBranchError(
          err instanceof Error ? err.message : "Failed to load branches"
        )
      } finally {
        setBranchLoading(false)
      }
    },
    [installationId, orgId, selectedRepo, source]
  )

  useEffect(() => {
    if (source !== "github" || !selectedRepo || !installationId || !orgId) {
      return
    }
    loadBranches()
  }, [installationId, loadBranches, orgId, selectedRepo, source])

  useEffect(() => {
    if (source !== "github" || !selectedRepo || !installationId || !orgId) {
      return
    }
    const handle = setTimeout(() => {
      const searchTerm = branchDirty ? branch.trim() : ""
      loadBranches(searchTerm || undefined)
    }, 250)
    return () => clearTimeout(handle)
  }, [
    branch,
    branchDirty,
    installationId,
    loadBranches,
    orgId,
    selectedRepo,
    source,
  ])

  const verifyConfigPath = useCallback(async () => {
    if (
      source !== "github" ||
      !installationId ||
      !selectedRepo?.full_name ||
      !branch.trim() ||
      !configPath.trim() ||
      !orgId
    ) {
      setConfigStatus("error")
      setConfigMessage("Pick a repo, branch, and config path first")
      return
    }

    setConfigStatus("checking")
    setConfigMessage(null)
    setConfigPreview(null)

    try {
      const params = new URLSearchParams({
        installationId,
        repo: selectedRepo.full_name,
        branch: branch.trim(),
        path: configPath.trim(),
        orgId,
      })
      const res = await fetch(`/api/github/config-check?${params.toString()}`)
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? "Config not found at that path")
      }
      setConfigStatus("ok")
      setConfigMessage("Config file verified in repository")
      setConfigPreview(data.preview ?? null)
    } catch (err) {
      setConfigStatus("error")
      setConfigMessage(
        err instanceof Error ? err.message : "Could not verify config file"
      )
    }
  }, [
    branch,
    configPath,
    installationId,
    orgId,
    selectedRepo?.full_name,
    source,
  ])

  const filteredRepos = useMemo(
    () =>
      (repos ?? []).filter((repo) =>
        repo.full_name.toLowerCase().includes(repoSearch.toLowerCase())
      ),
    [repoSearch, repos]
  )

  async function createSite(e: React.FormEvent) {
    e.preventDefault()
    if (!orgId || !name.trim()) return

    if (source === "github") {
      if (!installationId || !selectedRepo || !branch.trim() || !configPath) {
        setError("Select a repository, branch, and config path")
        return
      }
      if (configStatus !== "ok") {
        setError("Verify the config path before creating the site")
        return
      }
    }

    setSubmitting(true)
    setError(null)
    try {
      const siteId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}`

      const blobStoreId = ""
      const blobStoreUrl = ""

      await sitesCollection.insert({
        id: siteId,
        organization_id: orgId,
        name: name.trim(),
        slug: slug || slugifyValue(name),
        base_url: blobStoreUrl,
        store_id: blobStoreId,
        primary_host: null,
        created_at: new Date(),
        updated_at: new Date(),
        last_build_id: null,
        last_published_at: null,
        content_source: source,
        github_installation_id:
          source === "github" ? (installationId ?? null) : null,
        github_repo_full_name:
          source === "github" ? (selectedRepo?.full_name ?? null) : null,
        github_branch: source === "github" ? branch.trim() : null,
        github_config_path: source === "github" ? configPath.trim() : null,
      })
      setOpen(false)
      setName("")
      setSlug("")
      setSource("studio")
      setSlugTouched(false)
      setSelectedRepoId(null)
      setBranch("")
      setBranchSuggestions([])
      setConfigPath("docufy.config.json")
      setConfigStatus("idle")
      setConfigMessage(null)
      setConfigPreview(null)
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

  const githubBlocked = source === "github" && !installationId
  const githubReady =
    !!installationId &&
    !!selectedRepo &&
    !!branch.trim() &&
    !!configPath.trim() &&
    configStatus === "ok"
  const canSubmit =
    !!orgId && !!name.trim() && (source === "studio" ? true : githubReady)

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
          <DialogContent aria-label="Create site" className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create site</DialogTitle>
              <DialogDescription>
                Publish from Docufy Studio or a GitHub repository.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={createSite} className="space-y-4">
              <div className="grid gap-2">
                <Label>Source</Label>
                <Tabs
                  value={source}
                  onValueChange={(val) =>
                    setSource((val as "studio" | "github") ?? "studio")
                  }
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="studio">Docufy Studio</TabsTrigger>
                    <TabsTrigger value="github">
                      <Github className="mr-2 h-4 w-4" />
                      GitHub
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Product docs"
                />
              </div>
              <div className="grid gap-2">
                <Label>Slug</Label>
                <Input
                  value={slug}
                  onChange={(e) => {
                    const v = slugifyValue(e.target.value)
                    setSlug(v)
                    setSlugTouched(v.length > 0)
                  }}
                  placeholder="product-docs"
                />
                <p className="text-xs text-muted-foreground">
                  The slug is used in the site URL and domain defaults.
                </p>
              </div>

              {source === "github" ? (
                <>
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-2">
                      <Github className="h-4 w-4" />
                      Repository
                    </Label>
                    {!installationId ? (
                      <div className="rounded-md border border-dashed bg-muted/40 p-3 text-sm">
                        Connect the Docufy GitHub App in{" "}
                        <Link
                          to="/$orgSlug/settings"
                          params={{ orgSlug: currentSlug }}
                          className="font-medium underline"
                        >
                          settings
                        </Link>{" "}
                        to browse repositories for this workspace.
                      </div>
                    ) : (
                      <div className="rounded-md border">
                        <Command>
                          <CommandInput
                            value={repoSearch}
                            onValueChange={(val) => {
                              setRepoSearch(val)
                              setRepoDropdownOpen(true)
                            }}
                            placeholder="Search repositories"
                            onFocus={() => setRepoDropdownOpen(true)}
                            onBlur={() => {
                              // Delay to allow click on items
                              setTimeout(() => setRepoDropdownOpen(false), 120)
                            }}
                          />
                          {repoDropdownOpen ? (
                            <CommandList className="max-h-56 overflow-auto border-t">
                              <CommandEmpty>
                                {repos === undefined
                                  ? "Syncing repositories…"
                                  : "No repositories found"}
                              </CommandEmpty>
                              <CommandGroup>
                                {filteredRepos.map((repo) => (
                                  <CommandItem
                                    key={repo.id}
                                    value={repo.full_name}
                                    onSelect={() => {
                                      setSelectedRepoId(String(repo.id))
                                      setRepoSearch(repo.full_name)
                                      setRepoDropdownOpen(false)
                                    }}
                                    className="flex items-start gap-3"
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium leading-tight">
                                        {repo.full_name}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        Default branch: {repo.default_branch} ·{" "}
                                        {repo.private ? "Private" : "Public"}
                                      </span>
                                    </div>
                                    {selectedRepoId === String(repo.id) ? (
                                      <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-500" />
                                    ) : null}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          ) : null}
                        </Command>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4" />
                      Branch
                    </Label>
                    <Input
                      value={branch}
                      onChange={(e) => {
                        setBranch(e.target.value)
                        setBranchDirty(true)
                      }}
                      placeholder={selectedRepo?.default_branch || "main"}
                      disabled={!selectedRepo}
                    />
                    {branchLoading ? (
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading branch suggestions…
                      </p>
                    ) : null}
                    {branchError ? (
                      <p className="text-sm text-destructive">{branchError}</p>
                    ) : null}
                    {branchSuggestions.length ? (
                      <div className="flex flex-wrap gap-2">
                        {branchSuggestions.slice(0, 6).map((b) => (
                          <Button
                            key={b}
                            type="button"
                            variant={branch === b ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setBranch(b)}
                          >
                            {b}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-2">
                    <Label>Config path in repo</Label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        value={configPath}
                        onChange={(e) => setConfigPath(e.target.value)}
                        placeholder="docs/docufy.config.json"
                        disabled={!selectedRepo}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={verifyConfigPath}
                        disabled={
                          !selectedRepo ||
                          !branch.trim() ||
                          !configPath.trim() ||
                          configStatus === "checking"
                        }
                      >
                        {configStatus === "checking" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Verify config
                      </Button>
                    </div>
                    {configMessage ? (
                      <p
                        className={cn(
                          "text-sm",
                          configStatus === "ok"
                            ? "text-emerald-600"
                            : "text-destructive"
                        )}
                      >
                        {configMessage}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Provide the path to your Docufy config file. We’ll
                        validate it before creating the site.
                      </p>
                    )}
                    {configPreview ? (
                      <pre className="max-h-28 overflow-auto rounded border bg-muted/40 p-2 text-xs">
                        {configPreview}
                        {configStatus === "ok" && configPreview.length >= 2000
                          ? "\n…"
                          : null}
                      </pre>
                    ) : null}
                  </div>
                </>
              ) : null}

              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !canSubmit || githubBlocked}
                >
                  {submitting
                    ? "Creating…"
                    : source === "github"
                      ? "Create GitHub site"
                      : "Create site"}
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
                {s.content_source === "github" ? (
                  <Badge
                    variant="outline"
                    className="ml-auto text-[10px] uppercase tracking-wide"
                  >
                    GitHub
                  </Badge>
                ) : null}
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
