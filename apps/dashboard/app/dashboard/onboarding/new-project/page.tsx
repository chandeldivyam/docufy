'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, Users } from 'lucide-react';
import type { Id } from '@/convex/_generated/dataModel';

export default function OnboardingPage() {
  const router = useRouter();
  const pendingInvites = useQuery(api.userInvites.listMyPendingInvites);
  const acceptInvite = useMutation(api.userInvites.acceptInvite);
  const declineInvite = useMutation(api.userInvites.declineInvite);
  const createProject = useMutation(api.projects.create);

  const [processingInvite, setProcessingInvite] = useState<Id<'projectInvites'> | null>(null);
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectName, setProjectName] = useState('');

  const validInvites = pendingInvites?.filter((invite) => !invite.isExpired) ?? [];
  const expiredInvites = pendingInvites?.filter((invite) => invite.isExpired) ?? [];

  async function handleAcceptInvite(inviteId: Id<'projectInvites'>, setAsDefault: boolean = true) {
    setProcessingInvite(inviteId);
    try {
      const { projectId } = await acceptInvite({ inviteId, setAsDefault });

      // Set the active project cookie
      await fetch('/api/active-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      router.push(`/dashboard/${projectId}`);
    } catch (error) {
      console.error('Failed to accept invite:', error);
      setProcessingInvite(null);
    }
  }

  async function handleDeclineInvite(inviteId: Id<'projectInvites'>) {
    setProcessingInvite(inviteId);
    try {
      await declineInvite({ inviteId });
    } catch (error) {
      console.error('Failed to decline invite:', error);
    } finally {
      setProcessingInvite(null);
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!projectName.trim()) return;

    setCreatingProject(true);
    try {
      const projectId = await createProject({ name: projectName });

      await fetch('/api/active-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      router.push(`/dashboard/${projectId}`);
    } catch (error) {
      console.error('Failed to create project:', error);
      setCreatingProject(false);
    }
  }

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Welcome to Docufy</h1>
        <p className="text-muted-foreground mt-2">
          Accept project invitations or create your own project to get started
        </p>
      </div>

      {validInvites.length > 0 && (
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Pending Invitations
              </CardTitle>
              <CardDescription>
                You have been invited to join the following projects
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {validInvites.map((invite) => (
                <div
                  key={invite._id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{invite.projectName}</span>
                      <Badge variant="secondary">{invite.role}</Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Invited by {invite.inviterName || 'Unknown'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeclineInvite(invite._id)}
                      disabled={processingInvite === invite._id}
                    >
                      <XCircle className="h-4 w-4" />
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAcceptInvite(invite._id)}
                      disabled={processingInvite === invite._id}
                    >
                      <CheckCircle className="h-4 w-4" />
                      Accept
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {expiredInvites.length > 0 && (
        <div className="mb-8">
          <Card className="border-muted">
            <CardHeader>
              <CardTitle className="text-muted-foreground flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Expired Invitations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {expiredInvites.map((invite) => (
                <div
                  key={invite._id}
                  className="border-muted flex items-center justify-between rounded-lg border p-4 opacity-60"
                >
                  <div>
                    <span className="font-medium">{invite.projectName}</span>
                    <p className="text-muted-foreground text-sm">
                      Invited by {invite.inviterName || 'Unknown'}
                    </p>
                  </div>
                  <Badge variant="outline">Expired</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Create a New Project</CardTitle>
          <CardDescription>Start fresh with your own documentation project</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateProject} className="space-y-4">
            <div>
              <label htmlFor="project-name" className="mb-1 block text-sm font-medium">
                Project name
              </label>
              <input
                id="project-name"
                type="text"
                className="w-full rounded-md border px-3 py-2"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="My Documentation"
                required
                disabled={creatingProject}
              />
            </div>
            <Button type="submit" disabled={creatingProject || !projectName.trim()}>
              {creatingProject ? 'Creating...' : 'Create Project'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
