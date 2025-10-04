// apps/web/src/lib/use-presence-user.ts
import { useMemo } from "react"
import { useLiveQuery } from "@tanstack/react-db"
import { authClient } from "@/lib/auth-client"
import {
  myOrganizationsCollection,
  getOrgUserProfilesCollection,
  emptyOrgUserProfilesCollection,
} from "@/lib/collections"
import {
  colorFromString,
  displayNameFrom,
  type PresenceUser,
} from "@/lib/presence"

export function usePresenceUser(orgSlug?: string) {
  const { data: session } = authClient.useSession()
  const { data: myOrgs } = useLiveQuery((q) =>
    q.from({ myOrganizations: myOrganizationsCollection })
  )

  const orgId =
    myOrgs?.find((o) => o.org_slug === orgSlug)?.organization_id ??
    session?.session?.activeOrganizationId

  const profilesCollection = useMemo(
    () =>
      orgId
        ? getOrgUserProfilesCollection(orgId)
        : emptyOrgUserProfilesCollection,
    [orgId]
  )

  const { data: profiles } = useLiveQuery(
    (q) => q.from({ users: profilesCollection }),
    [profilesCollection]
  )

  const me = profiles?.find((p) => p.user_id === session?.user?.id)

  const seed =
    session?.user?.id || session?.user?.email || me?.email || "anon-seed"

  const name = displayNameFrom({
    name: me?.name ?? session?.user?.name,
    email: me?.email ?? session?.user?.email,
  })

  const color = colorFromString(seed)

  return useMemo<PresenceUser>(() => {
    return {
      id: session?.user?.id ?? "anonymous",
      name: name!,
      email: me?.email ?? session?.user?.email ?? null,
      image: me?.image ?? session?.user?.image ?? null,
      color,
    }
  }, [
    session?.user?.id,
    me?.email,
    me?.image,
    name,
    color,
    session?.user?.email,
    session?.user?.image,
  ])
}
