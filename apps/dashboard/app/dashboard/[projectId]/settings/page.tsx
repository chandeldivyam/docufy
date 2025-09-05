'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
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
  Loader2,
  MoreHorizontal,
  Trash2,
  Shield,
  Edit3,
  Eye,
} from 'lucide-react';
import type { Id } from '@/convex/_generated/dataModel';

type Role = 'owner' | 'admin' | 'editor' | 'viewer';

export default function SettingsPage() {
  const params = useParams();
  const projectId = params.projectId as Id<'projects'>;

  const project = useQuery(api.projects.get, { projectId });
  const members = useQuery(api.projectMembers.listMembers, { projectId });
  const invites = useQuery(api.projectInvites.listProjectInvites, { projectId });
  const currentUser = useQuery(api.users.getCurrentUser);

  const inviteToProject = useMutation(api.projectInvites.inviteToProject);
  const cancelInvite = useMutation(api.projectInvites.cancelInvite);
  const updateMemberRole = useMutation(api.projectMembers.updateMemberRole);
  const removeMember = useMutation(api.projectMembers.removeMember);

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'editor' | 'viewer'>('viewer');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [processingMemberId, setProcessingMemberId] = useState<Id<'projectMembers'> | null>(null);

  // Get current user's role
  const currentUserMembership = members?.find((m) => m.userId === currentUser?._id);
  const canInvite =
    currentUserMembership?.role === 'owner' || currentUserMembership?.role === 'admin';
  const canManageMembers =
    currentUserMembership?.role === 'owner' || currentUserMembership?.role === 'admin';
  const isOwner = currentUserMembership?.role === 'owner';

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setIsInviting(true);
    setInviteError(null);

    try {
      await inviteToProject({
        projectId,
        inviteeEmail: inviteEmail,
        role: inviteRole,
      });
      setInviteEmail('');
      setInviteRole('viewer');
      setShowInviteForm(false);
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Failed to send invite');
    } finally {
      setIsInviting(false);
    }
  }

  async function handleCancelInvite(inviteId: Id<'projectInvites'>) {
    try {
      await cancelInvite({ inviteId });
    } catch (error) {
      console.error('Failed to cancel invite:', error);
    }
  }

  async function handleUpdateRole(
    memberId: Id<'projectMembers'>,
    newRole: 'admin' | 'editor' | 'viewer',
  ) {
    setProcessingMemberId(memberId);
    try {
      await updateMemberRole({ memberId, newRole });
    } catch (error) {
      console.error('Failed to update role:', error);
    } finally {
      setProcessingMemberId(null);
    }
  }

  async function handleRemoveMember(memberId: Id<'projectMembers'>) {
    if (!confirm('Are you sure you want to remove this member from the project?')) {
      return;
    }

    setProcessingMemberId(memberId);
    try {
      await removeMember({ memberId });
    } catch (error) {
      console.error('Failed to remove member:', error);
    } finally {
      setProcessingMemberId(null);
    }
  }

  const getRoleBadgeVariant = (role: Role): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (role) {
      case 'owner':
        return 'destructive';
      case 'admin':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getRoleIcon = (role: Role) => {
    switch (role) {
      case 'owner':
      case 'admin':
        return <Shield className="h-3 w-3" />;
      case 'editor':
        return <Edit3 className="h-3 w-3" />;
      case 'viewer':
        return <Eye className="h-3 w-3" />;
    }
  };

  const pendingInvites = invites?.filter((i) => i.status === 'pending' && !i.isExpired) ?? [];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Project Settings</h1>
        <p className="text-muted-foreground">
          {project === undefined ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading...
            </span>
          ) : (
            (project?.name ?? 'Unknown Project')
          )}
        </p>
      </div>

      <div className="bg-card rounded-lg border">
        <div className="border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Team Members</h2>
              <p className="text-muted-foreground text-sm">Manage who has access to this project</p>
            </div>
            {canInvite && !showInviteForm && (
              <Button onClick={() => setShowInviteForm(true)} size="sm">
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-6 p-6">
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
                    setInviteError(null);
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
                    disabled={isInviting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(value) => setInviteRole(value as 'admin' | 'editor' | 'viewer')}
                    disabled={isInviting}
                  >
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {isOwner && <SelectItem value="admin">Admin</SelectItem>}
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {inviteError && <p className="text-destructive text-sm">{inviteError}</p>}

              <Button type="submit" size="sm" disabled={isInviting}>
                {isInviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isInviting ? 'Sending...' : 'Send Invite'}
              </Button>
            </form>
          )}

          <div className="space-y-1">
            {members === undefined ? (
              <div className="text-muted-foreground flex items-center gap-2 py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading members...
              </div>
            ) : members.length === 0 ? (
              <p className="text-muted-foreground py-4 text-sm">No members yet</p>
            ) : (
              members.map((member) => {
                const isCurrentUser = member.userId === currentUser?._id;
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
                      <Badge variant={getRoleBadgeVariant(member.role)} className="gap-1">
                        {getRoleIcon(member.role)}
                        {member.role}
                      </Badge>
                      {canModifyMember && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={processingMemberId === member._id}
                            >
                              {processingMemberId === member._id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
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
              })
            )}
          </div>

          {pendingInvites.length > 0 && (
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
          )}
        </div>
      </div>
    </div>
  );
}
