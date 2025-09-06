'use client';

import { useMemo, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  RefreshCw,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Id } from '@/convex/_generated/dataModel';
import { toast } from 'sonner';
import { parseConvexError, getErrorMessage, isAuthError } from '@/lib/errors';
import { useQueryWithStatus } from '@/lib/convexHooks';
import { MembersListSkeleton, InviteItemSkeleton } from '@/components/settings/MembersSkeleton';

export default function SettingsPage() {
  const params = useParams();
  const projectId = params.projectId as Id<'projects'>;

  // Each query loads independently
  const membersQuery = useQueryWithStatus(api.projectMembers.listMembers, { projectId });
  const invitesQuery = useQueryWithStatus(api.projectInvites.listProjectInvites, { projectId });
  const meQuery = useQueryWithStatus(api.users.getCurrentUser, {});

  // Extract data
  const members = membersQuery.data;
  const invites = invitesQuery.data;
  const me = meQuery.data;

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

  // Render the page progressively - show what's loaded
  return (
    <div className="max-w-4xl space-y-6">
      {/* Header section with skeleton */}
      <div>
        <h1 className="text-2xl font-bold">Project Settings</h1>
      </div>

      {/* Team Members card - always show structure */}
      <div className="bg-card rounded-lg border">
        <div className="border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Team Members</h2>
              <p className="text-muted-foreground text-sm">Manage who has access to this project</p>
            </div>
            {/* Show skeleton for button area while loading permissions */}
            {membersQuery.isPending ? (
              <Skeleton className="h-9 w-32" />
            ) : (
              canInvite &&
              !showInviteForm && (
                <Button onClick={() => setShowInviteForm(true)} size="sm">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite Member
                </Button>
              )
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

          {/* Members section with skeleton loader */}
          {membersQuery.isPending ? (
            <MembersListSkeleton count={3} />
          ) : membersQuery.isError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Failed to load members</AlertTitle>
              <AlertDescription className="mt-2">
                {getErrorMessage(membersQuery.error)}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw className="mr-2 h-3 w-3" />
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : members && members.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground text-sm">No members yet</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Invite team members to collaborate on this project
              </p>
            </div>
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

          {/* Pending invites section with better loading */}
          {invitesQuery.isPending ? (
            // Show subtle loading state for invites
            canInvite && (
              <div className="space-y-1 border-t pt-4">
                <Skeleton className="mb-3 h-4 w-32" />
                <InviteItemSkeleton />
              </div>
            )
          ) : invitesQuery.isError ? (
            // Show error only if it's not an auth error (which is expected for viewers)
            !isAuthError(invitesQuery.error) ? (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{getErrorMessage(invitesQuery.error)}</AlertDescription>
              </Alert>
            ) : null
          ) : pendingInvites && pendingInvites.length > 0 ? (
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
