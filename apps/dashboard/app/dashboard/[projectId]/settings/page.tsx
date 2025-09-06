'use client';

import { useMemo, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  UserPlus,
  X,
  Clock,
  MoreHorizontal,
  Trash2,
  Shield,
  Edit3,
  Eye,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Id } from '@/convex/_generated/dataModel';
import { toast } from 'sonner';
import { parseConvexError } from '@/lib/errors';
import { useQueryWithStatus } from '@/lib/convexHooks';

export default function SettingsPage() {
  const params = useParams();
  const projectId = params.projectId as Id<'projects'>;

  // Each query loads independently
  const projectQuery = useQueryWithStatus(api.projects.get, { projectId });
  const membersQuery = useQueryWithStatus(api.projectMembers.listMembers, { projectId });
  const invitesQuery = useQueryWithStatus(api.projectInvites.listProjectInvites, { projectId });
  const meQuery = useQueryWithStatus(api.users.getCurrentUser, {});

  // Extract data
  const project = projectQuery.data;
  const members = membersQuery.data;
  const invites = invitesQuery.data;
  const me = meQuery.data;

  // Check for critical auth errors (project access is the most important)
  const hasProjectAuthError =
    projectQuery.isError &&
    (projectQuery.error?.message?.includes('FORBIDDEN') ||
      projectQuery.error?.message?.includes('UNAUTHORIZED'));

  // Mutations with optimistic updates
  const inviteToProject = useMutation(api.projectInvites.inviteToProject).withOptimisticUpdate(
    (store, { projectId, inviteeEmail, role }) => {
      const list = store.getQuery(api.projectInvites.listProjectInvites, { projectId });
      if (!list) return;
      const meVal = store.getQuery(api.users.getCurrentUser, {}) ?? null;
      const inviterName = meVal
        ? `${meVal.firstName ?? ''} ${meVal.lastName ?? ''}`.trim() || meVal.email
        : undefined;
      const now = Date.now();
      const optimisticId = `optimistic:${inviteeEmail}` as Id<'projectInvites'>;
      const withoutOld = list.filter(
        (i) => i.inviteeEmail.toLowerCase() !== inviteeEmail.toLowerCase(),
      );
      store.setQuery(api.projectInvites.listProjectInvites, { projectId }, [
        ...withoutOld,
        {
          _id: optimisticId,
          inviteeEmail: inviteeEmail.toLowerCase().trim(),
          role,
          status: 'pending' as const,
          inviterName,
          createdAt: now,
          expiresAt: now + 7 * 24 * 60 * 60 * 1000,
          isExpired: false,
        },
      ]);
    },
  );

  const cancelInvite = useMutation(api.projectInvites.cancelInvite).withOptimisticUpdate(
    (store, { inviteId }) => {
      const list = store.getQuery(api.projectInvites.listProjectInvites, { projectId });
      if (!list) return;
      store.setQuery(
        api.projectInvites.listProjectInvites,
        { projectId },
        list.filter((i) => i._id !== inviteId),
      );
    },
  );

  const updateMemberRole = useMutation(api.projectMembers.updateMemberRole).withOptimisticUpdate(
    (store, { memberId, newRole }) => {
      const list = store.getQuery(api.projectMembers.listMembers, { projectId });
      if (!list) return;
      const updated = list.map((m) => (m._id === memberId ? { ...m, role: newRole } : m));
      store.setQuery(api.projectMembers.listMembers, { projectId }, updated);
    },
  );

  const removeMember = useMutation(api.projectMembers.removeMember).withOptimisticUpdate(
    (store, { memberId }) => {
      const list = store.getQuery(api.projectMembers.listMembers, { projectId });
      if (!list) return;
      store.setQuery(
        api.projectMembers.listMembers,
        { projectId },
        list.filter((m) => m._id !== memberId),
      );
    },
  );

  // UI state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'editor' | 'viewer'>('viewer');

  const currentUserMembership = useMemo(() => {
    if (!members || !me) return undefined;
    return members.find((m) => m.userId === me._id);
  }, [members, me]);

  const canInvite =
    !!currentUserMembership &&
    (currentUserMembership.role === 'owner' || currentUserMembership.role === 'admin');
  const canManageMembers = canInvite;
  const isOwner = currentUserMembership?.role === 'owner';

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    try {
      await inviteToProject({ projectId, inviteeEmail: inviteEmail, role: inviteRole });
      toast.success('Invite sent');
      setInviteEmail('');
      setInviteRole('viewer');
      setShowInviteForm(false);
    } catch (error) {
      const { message, code } = parseConvexError(error);
      toast.error(message ?? code ?? 'Something went wrong');
    }
  }

  async function handleCancelInvite(inviteId: Id<'projectInvites'>) {
    try {
      await cancelInvite({ inviteId });
      toast.success('Invite canceled');
    } catch (error) {
      const { message, code } = parseConvexError(error);
      toast.error(message ?? code ?? 'Failed to cancel invite');
    }
  }

  async function handleUpdateRole(
    memberId: Id<'projectMembers'>,
    newRole: 'admin' | 'editor' | 'viewer',
  ) {
    try {
      await updateMemberRole({ memberId, newRole });
      toast.success('Member role updated');
    } catch (error) {
      const { message, code } = parseConvexError(error);
      toast.error(message ?? code ?? 'Failed to update role');
    }
  }

  async function handleRemoveMember(memberId: Id<'projectMembers'>) {
    if (!confirm('Remove this member from the project?')) return;
    try {
      await removeMember({ memberId });
      toast.success('Member removed');
    } catch (error) {
      const { message, code } = parseConvexError(error);
      toast.error(message ?? code ?? 'Failed to remove member');
    }
  }

  const pendingInvites = (invites ?? []).filter((i) => i.status === 'pending' && !i.isExpired);

  // Only block the entire page if we can't access the project at all
  if (hasProjectAuthError) {
    return (
      <div className="max-w-4xl space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            You don't have permission to view this project.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Render the page progressively - show what's loaded
  return (
    <div className="max-w-4xl space-y-6">
      {/* Header section - shows immediately with loading state if needed */}
      <div>
        <h1 className="text-2xl font-bold">Project Settings</h1>
        {projectQuery.isPending ? (
          <div className="bg-muted mt-1 h-4 w-32 animate-pulse rounded" />
        ) : projectQuery.isError ? (
          <p className="text-muted-foreground text-sm">Error loading project</p>
        ) : (
          <p className="text-muted-foreground">{project?.name ?? 'Unknown Project'}</p>
        )}
      </div>

      {/* Team Members card - always show structure */}
      <div className="bg-card rounded-lg border">
        <div className="border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Team Members</h2>
              <p className="text-muted-foreground text-sm">Manage who has access to this project</p>
            </div>
            {/* Only show invite button when we know user's permissions */}
            {!membersQuery.isPending && canInvite && !showInviteForm && (
              <Button onClick={() => setShowInviteForm(true)} size="sm">
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-6 p-6">
          {/* Invite form - shown based on state */}
          {showInviteForm && (
            <form onSubmit={handleInvite} className="bg-muted/30 space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Invite a new member</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowInviteForm(false);
                    setInviteEmail('');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(v) => setInviteRole(v as 'admin' | 'editor' | 'viewer')}
                  >
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {isOwner && <SelectItem value="admin">Admin</SelectItem>}
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button type="submit" size="sm">
                Send Invite
              </Button>
            </form>
          )}

          {/* Members section with independent loading/error states */}
          {membersQuery.isPending ? (
            <div className="space-y-3">
              <div className="text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading members...</span>
              </div>
            </div>
          ) : membersQuery.isError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load team members. Please try refreshing the page.
              </AlertDescription>
            </Alert>
          ) : members && members.length === 0 ? (
            <p className="text-muted-foreground py-4 text-sm">No members yet</p>
          ) : members ? (
            <div className="space-y-1">
              {members.map((member) => {
                const isCurrentUser = me && member.userId === me._id;
                const canModifyMember =
                  canManageMembers &&
                  !isCurrentUser &&
                  member.role !== 'owner' &&
                  (isOwner || member.role !== 'admin');

                return (
                  <div
                    key={member._id}
                    className="hover:bg-accent/50 flex items-center justify-between rounded-lg px-2 py-3 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {member.user?.firstName || member.user?.lastName
                            ? `${member.user.firstName ?? ''} ${member.user.lastName ?? ''}`.trim()
                            : 'Unknown User'}
                        </p>
                        {isCurrentUser && (
                          <span className="text-muted-foreground text-xs">(You)</span>
                        )}
                      </div>
                      <p className="text-muted-foreground text-sm">
                        {member.user?.email ?? 'No email'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          member.role === 'owner'
                            ? 'destructive'
                            : member.role === 'admin'
                              ? 'default'
                              : 'secondary'
                        }
                        className="gap-1"
                      >
                        {member.role === 'owner' || member.role === 'admin' ? (
                          <Shield className="h-3 w-3" />
                        ) : member.role === 'editor' ? (
                          <Edit3 className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                        {member.role}
                      </Badge>

                      {canModifyMember && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleUpdateRole(member._id, 'viewer')}
                              disabled={member.role === 'viewer'}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              Change to Viewer
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleUpdateRole(member._id, 'editor')}
                              disabled={member.role === 'editor'}
                            >
                              <Edit3 className="mr-2 h-4 w-4" />
                              Change to Editor
                            </DropdownMenuItem>
                            {isOwner && (
                              <DropdownMenuItem
                                onClick={() => handleUpdateRole(member._id, 'admin')}
                                disabled={member.role === 'admin'}
                              >
                                <Shield className="mr-2 h-4 w-4" />
                                Change to Admin
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleRemoveMember(member._id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove from project
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* Pending invites section - loads independently */}
          {invitesQuery.isPending ? (
            // Show loading state only if there might be invites
            <div className="border-t pt-4">
              <div className="text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-xs">Checking invitations...</span>
              </div>
            </div>
          ) : invitesQuery.isError ? // Silently fail for invites - not critical
          null : pendingInvites && pendingInvites.length > 0 ? (
            <div className="space-y-1 border-t pt-4">
              <h3 className="text-muted-foreground mb-3 text-sm font-medium">
                Pending Invitations
              </h3>
              {pendingInvites.map((invite) => (
                <div
                  key={invite._id}
                  className="hover:bg-accent/50 flex items-center justify-between rounded-lg px-2 py-3 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Clock className="text-muted-foreground h-4 w-4" />
                    <div>
                      <p className="font-medium">{invite.inviteeEmail}</p>
                      <p className="text-muted-foreground text-sm">
                        Invited by {invite.inviterName ?? 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{invite.role}</Badge>
                    {canInvite && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCancelInvite(invite._id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
