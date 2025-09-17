import {
  createFileRoute,
  Outlet,
  Navigate,
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"
import { useEffect, useMemo } from "react"
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
  Settings as SettingsIcon,
  Users,
  Plus,
} from "lucide-react"
import { useLiveQuery } from "@tanstack/react-db"
import { myOrganizationsCollection } from "@/lib/collections"
import { ThemeToggle } from "@/components/theme-toggle"

export const Route = createFileRoute("/_authenticated/$orgSlug")({
  ssr: false,
  loader: async () => {
    await myOrganizationsCollection.preload()
    return null
  },
  component: OrgSlugLayout,
})

function OrgSlugLayout() {
  const { orgSlug } = Route.useParams()
  const { data: session, isPending: sPending } = authClient.useSession()
  const { data: activeOrg } = authClient.useActiveOrganization()
  const routerState = useRouterState()

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

  if (sPending || myOrgs === undefined)
    return <div className="p-8 text-muted-foreground">Loading…</div>
  if (!session) return <Navigate to="/login" replace />
  if (!current) return <Navigate to="/orgs" replace />

  return (
    <div className="grid h-[100svh] grid-cols-[260px_1fr]">
      {/* Sidebar */}
      <aside className="border-r bg-background">
        <div className="flex h-14 items-center gap-2 px-3 border-b">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <OrgSwitcher currentSlug={orgSlug} />
        </div>

        <nav className="p-2">
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

        <div className="mt-auto p-2 space-y-2">
          {/* Theme Toggle */}
          <div className="flex items-center justify-between px-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              className="justify-center"
              onClick={() => authClient.signOut()}
            >
              <LogOut />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="min-w-0">
        <div className="p-4">
          <Outlet />
        </div>
      </main>
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
