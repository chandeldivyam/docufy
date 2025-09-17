import { createFileRoute } from "@tanstack/react-router"
import { useLiveQuery } from "@tanstack/react-db"
import { authClient } from "@/lib/auth-client"
import {
  orgUserProfilesCollection,
  invitationsCollection,
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
import { Trash2 } from "lucide-react"

export const Route = createFileRoute("/_authenticated/_active-org/settings")({
  ssr: false,
  loader: async () => {
    await Promise.all([
      orgUserProfilesCollection.preload(),
      invitationsCollection.preload(),
    ])
    return null
  },
  component: SettingsPage,
})

function SettingsPage() {
  const { data: activeOrg } = authClient.useActiveOrganization()

  const { data: profiles } = useLiveQuery((q) =>
    q.from({ users: orgUserProfilesCollection })
  )
  const { data: allInvites } = useLiveQuery((q) =>
    q.from({ invitations: invitationsCollection })
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
                      <div className="font-medium">
                        {p.name ?? p.user_id} here
                      </div>
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
                      className="flex items-center justify-between rounded border p-3"
                    >
                      <div>
                        <div className="font-medium">{inv.email}</div>
                        <div className="text-xs text-muted-foreground">
                          role: {inv.role}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          onClick={() =>
                            authClient.organization.inviteMember({
                              email: inv.email,
                              role: inv.role as "member" | "admin" | "owner",
                              organizationId: activeOrg!.id,
                              resend: true,
                            })
                          }
                        >
                          Resend
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            authClient.organization.cancelInvitation({
                              invitationId: inv.id,
                            })
                          }
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Cancel
                        </Button>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function InviteForm() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("member")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  async function invite() {
    if (!activeOrg?.id) return
    setSubmitting(true)
    setError(null)
    setOk(false)
    const { error } = await authClient.organization.inviteMember({
      email,
      role: role as "member" | "admin" | "owner",
      organizationId: activeOrg.id,
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
