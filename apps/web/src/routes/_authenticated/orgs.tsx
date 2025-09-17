import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useLiveQuery } from "@tanstack/react-db"
import { authClient } from "@/lib/auth-client"
import {
  userInvitationsCollection,
  myOrganizationsCollection,
} from "@/lib/collections"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

export const Route = createFileRoute("/_authenticated/orgs")({
  loader: async () => {
    await Promise.all([
      userInvitationsCollection.preload(),
      myOrganizationsCollection.preload(),
    ])
    return null
  },
  component: OrgsPage,
  ssr: false,
})

// Use Better Auth for organizations; Electric only for invites
type ListOrgsRes = Awaited<ReturnType<typeof authClient.organization.list>>
type ListedOrg = NonNullable<ListOrgsRes["data"]>[number]

function OrgsPage() {
  const navigate = useNavigate()

  // 1) My organizations (Better Auth hook)
  const { data: orgs } = useLiveQuery((q) =>
    q.from({ myOrganizations: myOrganizationsCollection })
  )

  // 2) Pending invitations (Electric, reactive)
  const { data: invitations } = useLiveQuery((q) =>
    q.from({ invitations: userInvitationsCollection })
  )

  // 3) Form state
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [checking, setChecking] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function slugify(input: string) {
    return input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "")
  }

  useEffect(() => {
    setSlug((s) => (name && !s ? slugify(name) : s))
  }, [name])

  async function checkSlug(s: string) {
    setChecking(true)
    const { data, error } = await authClient.organization.checkSlug({ slug: s })
    setChecking(false)
    setAvailable(error ? null : !!data?.status)
  }

  async function createOrg() {
    setSubmitting(true)
    setError(null)
    try {
      const finalSlug = slug || slugify(name)
      if (!finalSlug) throw new Error("Please provide a valid name or slug")

      if (available === false) throw new Error("Slug is already taken")

      // create
      const { data, error } = await authClient.organization.create({
        name,
        slug: finalSlug,
        keepCurrentActiveOrganization: false,
      })
      if (error || !data)
        throw new Error(error?.message ?? "Failed to create organization")

      // set active and enter app at slugged URL
      await authClient.organization.setActive({ organizationId: data.id })
      navigate({ to: `/${finalSlug}` })
    } catch (e) {
      console.error(e)
      setError("Unable to create organization")
    } finally {
      setSubmitting(false)
    }
  }

  async function setActive(orgId: string, slug?: string | null) {
    await authClient.organization.setActive({ organizationId: orgId })
    if (slug) navigate({ to: `/${slug}` })
    else navigate({ to: "/" }) // root will redirect to slug
  }

  async function acceptInvitation(inviteId: string) {
    await authClient.organization.acceptInvitation({ invitationId: inviteId })
    // After accepting, Better Auth made us a member; pick that org automatically
    const { data: orgs } = await authClient.organization.list()
    const joined = orgs?.find(
      (o: ListedOrg) => o.membership?.status === "active"
    )
    if (joined) await setActive(joined.id)
  }

  async function rejectInvitation(inviteId: string) {
    await authClient.organization.rejectInvitation({ invitationId: inviteId })
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold">
        Choose or create an organization
      </h1>
      <p className="text-muted-foreground mt-2">
        You can join an existing workspace, accept an invitation, or create a
        new one.
      </p>

      <Tabs defaultValue="mine" className="mt-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="mine">My organizations</TabsTrigger>
          <TabsTrigger value="invites">Invitations</TabsTrigger>
          <TabsTrigger value="create">Create</TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle>My organizations</CardTitle>
              <CardDescription>Pick one to continue</CardDescription>
            </CardHeader>
            <CardContent>
              {!orgs?.length ? (
                <div className="text-muted-foreground">
                  You dont belong to any organizations yet.
                </div>
              ) : (
                <ul className="grid gap-3">
                  {orgs.map((org) => (
                    <li
                      key={org.organization_id}
                      className="flex items-center justify-between rounded border p-3"
                    >
                      <div>
                        <div className="font-medium">{org.org_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {org.org_slug}
                        </div>
                      </div>
                      <Button
                        onClick={() =>
                          setActive(org.organization_id, org.org_slug)
                        }
                      >
                        Use this workspace
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invites" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle>Pending invitations</CardTitle>
              <CardDescription>Accept or reject</CardDescription>
            </CardHeader>
            <CardContent>
              {!invitations?.length ? (
                <div className="text-muted-foreground">
                  No invitations found.
                </div>
              ) : (
                <ul className="grid gap-3">
                  {invitations
                    .filter((inv) => inv.status === "pending")
                    .map((inv) => (
                      <li
                        key={inv.id}
                        className="flex items-center justify-between rounded border p-3"
                      >
                        <div>
                          <div className="font-medium">
                            {inv.organizationId}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {inv.email} • role: {inv.role}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="default"
                            onClick={() => acceptInvitation(inv.id)}
                          >
                            Accept
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => rejectInvitation(inv.id)}
                          >
                            Reject
                          </Button>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle>Create new organization</CardTitle>
              <CardDescription>
                Start fresh with a new workspace
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="org-name">Name</Label>
                <Input
                  id="org-name"
                  placeholder="Acme Inc."
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setAvailable(null)
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="org-slug">Slug</Label>
                <div className="flex gap-2">
                  <Input
                    id="org-slug"
                    placeholder="acme"
                    value={slug}
                    onChange={(e) => {
                      setSlug(slugify(e.target.value))
                      setAvailable(null)
                    }}
                    onBlur={() => slug && checkSlug(slug)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => slug && checkSlug(slug)}
                    disabled={!slug || checking}
                  >
                    {checking ? "Checking…" : "Check"}
                  </Button>
                </div>
                {available === true && (
                  <p className="text-sm text-emerald-600">Slug available</p>
                )}
                {available === false && (
                  <p className="text-sm text-destructive">Slug taken</p>
                )}
              </div>

              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}

              <Button onClick={createOrg} disabled={submitting || !name}>
                {submitting ? "Creating…" : "Create organization"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
