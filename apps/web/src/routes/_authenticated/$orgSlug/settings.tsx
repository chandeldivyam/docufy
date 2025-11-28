import { createFileRoute } from "@tanstack/react-router"
import { useLiveQuery } from "@tanstack/react-db"
import { authClient } from "@/lib/auth-client"
import {
  myOrganizationsCollection,
  emptyOrgUserProfilesCollection,
  emptyInvitationsCollection,
  getOrgUserProfilesCollection,
  getOrgInvitationsCollection,
  emptyGithubInstallationsCollection,
  getOrgGithubInstallationsCollection,
} from "@/lib/collections"

import { useState } from "react"
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
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle2,
  ExternalLink,
  Github,
  Loader2,
  Trash2,
} from "lucide-react"

export const Route = createFileRoute("/_authenticated/$orgSlug/settings")({
  ssr: false,
  // Per-org collections load on demand via orgId param
  component: SettingsPage,
})

function SettingsPage() {
  const { orgSlug } = Route.useParams()
  // Map slug -> orgId from cached org list
  const { data: myOrgs } = useLiveQuery((q) =>
    q.from({ myOrganizations: myOrganizationsCollection })
  )
  const orgId = myOrgs?.find((o) => o.org_slug === orgSlug)?.organization_id

  // Use org-scoped Electric shapes so switching slug reconnects
  const profilesCollection = orgId
    ? getOrgUserProfilesCollection(orgId)
    : emptyOrgUserProfilesCollection
  const invitationsCollection = orgId
    ? getOrgInvitationsCollection(orgId)
    : emptyInvitationsCollection

  const { data: profiles } = useLiveQuery(
    (q) => q.from({ users: profilesCollection }),
    [profilesCollection]
  )
  const { data: allInvites } = useLiveQuery(
    (q) => q.from({ invitations: invitationsCollection }),
    [invitationsCollection]
  )

  return (
    <div className="space-y-8">
      <section>
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>People who currently have access</CardDescription>
          </CardHeader>
          <CardContent>
            {!profiles?.length ? (
              <p className="text-sm text-muted-foreground">No members yet.</p>
            ) : (
              <ul className="divide-y">
                {profiles.map((p) => (
                  <li
                    key={`${p.organization_id}:${p.user_id}`}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <div className="font-medium">{p.name ?? p.user_id}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.email}
                      </div>
                    </div>
                    <div className="text-xs rounded bg-muted px-2 py-1">
                      {p.role}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <InviteForm />
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
            <CardDescription>Resend or cancel as needed</CardDescription>
          </CardHeader>
          <CardContent>
            {!allInvites?.filter((i) => i.status === "pending").length ? (
              <p className="text-sm text-muted-foreground">
                No pending invitations.
              </p>
            ) : (
              <ul className="grid gap-2">
                {allInvites
                  .filter((inv) => inv.status === "pending")
                  .map((inv) => (
                    <li
                      key={inv.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate" title={inv.email}>
                          {inv.email}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          role: {inv.role}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 flex-shrink-0">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            authClient.organization.inviteMember({
                              email: inv.email,
                              role: inv.role as "member" | "admin" | "owner",
                              organizationId: orgId!,
                              resend: true,
                            })
                          }
                        >
                          Resend
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            authClient.organization.cancelInvitation({
                              invitationId: inv.id,
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Cancel</span>
                        </Button>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <GitHubIntegrationCard orgId={orgId} />
      </section>
    </div>
  )
}

function InviteForm() {
  const { orgSlug } = Route.useParams()
  const { data: myOrgs } = useLiveQuery((q) =>
    q.from({ myOrganizations: myOrganizationsCollection })
  )
  const activeOrg = authClient.useActiveOrganization().data
  const orgId =
    myOrgs?.find((o) => o.org_slug === orgSlug)?.organization_id ||
    activeOrg?.id
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("member")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  async function invite() {
    if (!orgId) return
    setSubmitting(true)
    setError(null)
    setOk(false)
    const { error } = await authClient.organization.inviteMember({
      email,
      role: role as "member" | "admin" | "owner",
      organizationId: orgId,
    })
    setSubmitting(false)
    if (error) setError(error.message ?? "Failed to send invite")
    else {
      setOk(true)
      setEmail("")
      setRole("member")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite a user</CardTitle>
        <CardDescription>
          Send an invitation to join this workspace
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label>Role</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="owner">Owner</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {ok ? (
          <p className="text-sm text-emerald-600">Invitation sent</p>
        ) : null}

        <Button onClick={invite} disabled={submitting || !email}>
          {submitting ? "Sending…" : "Send invite"}
        </Button>
      </CardContent>
    </Card>
  )
}

function GitHubIntegrationCard({ orgId }: { orgId?: string }) {
  const installationsCollection = orgId
    ? getOrgGithubInstallationsCollection(orgId)
    : emptyGithubInstallationsCollection
  const { data: installations } = useLiveQuery(
    (q) => q.from({ installations: installationsCollection }),
    [installationsCollection]
  )
  const installation = installations?.[0] ?? null
  const loading = !!orgId && installations === undefined

  const slug = import.meta.env.VITE_PUBLIC_GITHUB_APP_SLUG
  const installUrl =
    slug && orgId
      ? `https://github.com/apps/${slug}/installations/new?state=${encodeURIComponent(
          JSON.stringify({ organizationId: orgId })
        )}`
      : null

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            GitHub
          </CardTitle>
        </div>
        {installation ? (
          <Badge variant="outline" className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            Connected
          </Badge>
        ) : (
          <Badge variant="secondary">Not connected</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {installation ? (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="font-medium">
                Installed on {installation.account_login}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Installation ID: {installation.id} · Type:{" "}
              {installation.account_type}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No GitHub installation found for this organization.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild disabled={!installUrl || loading}>
            <a href={installUrl ?? "#"} target="_blank" rel="noreferrer">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {installation ? "Manage on GitHub" : "Connect GitHub"}
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
          {!installUrl && (
            <span className="text-xs text-muted-foreground">
              Set VITE_PUBLIC_GITHUB_APP_SLUG to enable the install link.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
