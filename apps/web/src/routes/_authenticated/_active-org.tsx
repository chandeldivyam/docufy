import {
  createFileRoute,
  Outlet,
  Navigate,
  Link,
  useRouterState,
  useNavigate,
} from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"
import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import {
  LogOut,
  ChevronDown,
  Plus,
  Home as HomeIcon,
  Settings as SettingsIcon,
  Building2,
  Users,
} from "lucide-react"
import { useLiveQuery } from "@tanstack/react-db"
import { organizationsCollection } from "@/lib/collections"

export const Route = createFileRoute("/_authenticated/_active-org")({
  ssr: false,
  loader: async () => {
    await organizationsCollection.preload()
  },
  component: ActiveOrgGate,
})

function ActiveOrgGate() {
  const { data: session, isPending: sPending } = authClient.useSession()
  const { data: activeOrg, isPending: oPending } =
    authClient.useActiveOrganization()
  if (sPending || oPending)
    return <div className="p-8 text-muted-foreground">Loading…</div>
  if (!session) return <Navigate to="/login" replace />
  if (!activeOrg) return <Navigate to="/orgs" replace />
  return <AppLayout />
}

function AppLayout() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const navigate = useNavigate()

  // Live list of orgs for the switcher
  const { data: allOrgs } = useLiveQuery((q) =>
    q.from({ organizations: organizationsCollection })
  )

  async function setActive(orgId: string) {
    await authClient.organization.setActive({ organizationId: orgId })
    navigate({ to: "/" })
  }

  return (
    <div className="grid h-[100svh] grid-cols-[260px_1fr]">
      {/* Sidebar */}
      <aside className="border-r bg-background">
        <div className="flex h-14 items-center gap-2 px-3 border-b">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <OrgSwitcher
            activeOrgId={activeOrg!.id}
            orgs={allOrgs ?? []}
            onSwitch={setActive}
          />
        </div>

        <nav className="p-2">
          <NavItem to="/" icon={<HomeIcon className="h-4 w-4" />}>
            Home
          </NavItem>
          <NavItem to="/settings" icon={<SettingsIcon className="h-4 w-4" />}>
            Settings
          </NavItem>
        </nav>

        <div className="mt-auto p-2">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => authClient.signOut()}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="min-w-0">
        <div className="flex h-14 items-center justify-between border-b px-4">
          <div className="font-medium truncate">{activeOrg?.name}</div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate({ to: "/orgs" })}
          >
            <Plus className="mr-1 h-4 w-4" />
            New workspace
          </Button>
        </div>

        <div className="p-4">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function OrgSwitcher({
  activeOrgId,
  orgs,
  onSwitch,
}: {
  activeOrgId: string
  orgs: Array<{ id: string; name: string; slug: string | null }>
  onSwitch: (id: string) => void
}) {
  const active = useMemo(
    () => orgs.find((o) => o.id === activeOrgId),
    [orgs, activeOrgId]
  )
  const navigate = useNavigate()
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
        {orgs.map((org) => (
          <DropdownMenuItem
            key={org.id}
            className={cn(
              "flex items-center gap-2",
              org.id === activeOrgId && "font-medium"
            )}
            onClick={() => onSwitch(org.id)}
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
  icon,
  children,
}: {
  to: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  const routerState = useRouterState()
  const isActive = routerState.location.pathname === to
  return (
    <Link
      to={to}
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
