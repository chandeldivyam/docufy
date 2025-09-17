import { createFileRoute, Navigate } from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"
import { useLiveQuery } from "@tanstack/react-db"
import { myOrganizationsCollection } from "@/lib/collections"

export const Route = createFileRoute("/_authenticated/_active-org")({
  ssr: false,
  loader: async () => {
    await myOrganizationsCollection.preload()
  },
  component: ActiveOrgGate,
})

function ActiveOrgGate() {
  const { data: session, isPending: sPending } = authClient.useSession()
  const { data: activeOrg, isPending: oPending } =
    authClient.useActiveOrganization()
  const { data: allOrgs } = useLiveQuery((q) =>
    q.from({ myOrganizations: myOrganizationsCollection })
  )

  if (sPending || oPending)
    return <div className="p-8 text-muted-foreground">Loading…</div>
  if (!session) return <Navigate to="/login" replace />
  if (!activeOrg) return <Navigate to="/orgs" replace />

  const slug = allOrgs?.find(
    (o) => o.organization_id === activeOrg.id
  )?.org_slug
  if (!slug) return <Navigate to="/orgs" replace />

  // New URL style: /:orgSlug
  return <Navigate to="/$orgSlug" params={{ orgSlug: slug }} replace />
}

// This component used to render the app layout. With slug URLs, the
// layout lives under `/_authenticated/$orgSlug`. We keep the component
// definitions below for type stability but they are no longer used.
// legacy component placeholders removed; this route now only redirects
