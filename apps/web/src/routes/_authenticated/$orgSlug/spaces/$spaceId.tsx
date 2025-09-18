import { createFileRoute, Outlet } from "@tanstack/react-router"
import { useLiveQuery } from "@tanstack/react-db"
import {
  myOrganizationsCollection,
  getOrgSpacesCollection,
  emptySpacesCollection,
} from "@/lib/collections"

export const Route = createFileRoute(
  "/_authenticated/$orgSlug/spaces/$spaceId"
)({
  ssr: false,
  component: SpacePage,
})

function SpacePage() {
  const { orgSlug, spaceId } = Route.useParams()

  // Map slug -> orgId from cached org list
  const { data: myOrgs } = useLiveQuery((q) =>
    q.from({ myOrganizations: myOrganizationsCollection })
  )
  const orgId = myOrgs?.find((o) => o.org_slug === orgSlug)?.organization_id

  // Org-scoped Electric shape
  const spacesCollection = orgId
    ? getOrgSpacesCollection(orgId)
    : emptySpacesCollection

  const { data: spaces } = useLiveQuery((q) =>
    q.from({ spaces: spacesCollection })
  )

  // Accept both id and slug for robustness
  const space = spaces?.find((s) => s.id === spaceId)

  if (!space) {
    return <div className="p-8 text-muted-foreground">Space not found</div>
  }

  return (
    <div className="space-y-4">
      <header className="border-b pb-4">
        <h1 className="text-2xl font-semibold">{space.name}</h1>
        <p className="text-sm text-muted-foreground">
          /{orgSlug}/spaces/{space.slug}
        </p>
      </header>

      {/* Future nested routes render here */}
      <Outlet />
    </div>
  )
}
