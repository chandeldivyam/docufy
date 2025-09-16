import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"

export const Route = createFileRoute("/_authenticated/_active-org")({
  ssr: false,
  component: ActiveOrgGate,
})

function ActiveOrgGate() {
  const { data: session, isPending: sPending } = authClient.useSession()
  const { data: activeOrg, isPending: oPending } =
    authClient.useActiveOrganization()

  if (sPending || oPending) {
    return <div className="p-8 text-muted-foreground">Loading…</div>
  }
  if (!session) {
    return <Navigate to="/login" replace />
  }
  if (!activeOrg) {
    return <Navigate to="/orgs" replace />
  }

  return <Outlet />
}
