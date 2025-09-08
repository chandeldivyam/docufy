'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/ui/dropdown-menu';
import { Plus, AlertCircle, RefreshCw, Hash } from 'lucide-react';
import { IconPickerGrid, getIconComponent } from '@/components/icons/iconOptions';
import { cn } from '@/lib/utils';
import type { Id } from '@/convex/_generated/dataModel';
import { toast } from 'sonner';
import { parseConvexError, getErrorMessage, isAuthError } from '@/lib/errors';
import { useQueryWithStatus } from '@/lib/convexHooks';

interface SpacesListProps {
  projectId: Id<'projects'>;
  collapsed?: boolean;
}

export function SpacesList({ projectId, collapsed }: SpacesListProps) {
  const pathname = usePathname();

  // Load data with status
  const spacesQuery = useQueryWithStatus(api.spaces.list, { projectId });
  const meQuery = useQueryWithStatus(api.users.getCurrentUser, {});
  const membersQuery = useQueryWithStatus(api.projectMembers.listMembers, { projectId });

  // Extract data
  const spaces = spacesQuery.data ?? [];
  const me = meQuery.data;
  const members = membersQuery.data;

  // Calculate permissions
  const currentUserMembership = useMemo(() => {
    if (!members || !me) return undefined;
    return members.find((m) => m.userId === me._id);
  }, [members, me]);

  const canCreateSpace =
    !!currentUserMembership && ['owner', 'admin', 'editor'].includes(currentUserMembership.role);

  // Mutations
  const createSpace = useMutation(api.spaces.create).withOptimisticUpdate(
    (store, { projectId, name, description, iconName }) => {
      const list = store.getQuery(api.spaces.list, { projectId });
      if (!list) return;
      const now = Date.now();
      const optimisticId = `optimistic:${name}` as Id<'spaces'>;
      store.setQuery(api.spaces.list, { projectId }, [
        ...list,
        {
          _id: optimisticId,
          _creationTime: now,
          projectId,
          name,
          slug: name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .slice(0, 50),
          description,
          iconName,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    },
  );

  // Form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceDescription, setNewSpaceDescription] = useState('');
  const [newSpaceIconName, setNewSpaceIconName] = useState('FileText');

  async function handleCreateSpace(e: React.FormEvent) {
    e.preventDefault();
    if (!newSpaceName.trim()) return;

    try {
      await createSpace({
        projectId,
        name: newSpaceName.trim(),
        description: newSpaceDescription.trim() || undefined,
        iconName: newSpaceIconName,
      });
      toast.success('Space created successfully');
      setNewSpaceName('');
      setNewSpaceDescription('');
      setNewSpaceIconName('FileText');
      setShowCreateForm(false);
    } catch (error) {
      const { message, code } = parseConvexError(error);
      toast.error(message ?? code ?? 'Failed to create space');
    }
  }

  // Loading state
  if (spacesQuery.isPending) {
    return (
      <div className="space-y-1">
        {collapsed ? (
          <>
            <Skeleton className="mx-1 h-8 w-8 rounded-md" />
            <Skeleton className="mx-1 h-8 w-8 rounded-md" />
            <Skeleton className="mx-1 h-8 w-8 rounded-md" />
          </>
        ) : (
          <>
            <div className="flex items-center justify-between px-3 py-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-6" />
            </div>
            <Skeleton className="mx-2 h-8 rounded-md" />
            <Skeleton className="mx-2 h-8 rounded-md" />
            <Skeleton className="mx-2 h-8 rounded-md" />
          </>
        )}
      </div>
    );
  }

  // Error state
  if (spacesQuery.isError && !isAuthError(spacesQuery.error)) {
    return (
      <div className={cn('space-y-2', collapsed && 'px-1')}>
        {!collapsed && (
          <div className="px-3 py-1">
            <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              Spaces
            </h3>
          </div>
        )}
        <Alert variant="destructive" className={cn(collapsed && 'mx-1')}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className={cn(collapsed && 'sr-only')}>
            {getErrorMessage(spacesQuery.error)}
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
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Header with create button */}
      {!collapsed && (
        <div className="flex items-center justify-between px-3 py-2">
          <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            Spaces
          </h3>
          {canCreateSpace && (
            <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Plus className="h-3 w-3" />
                  <span className="sr-only">Create space</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Space</DialogTitle>
                  <DialogDescription>
                    Spaces help you organize your documentation into logical groups.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateSpace} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
                    <div className="space-y-2">
                      <Label htmlFor="icon">Icon</Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" type="button" className="w-16 justify-center">
                            {(() => {
                              const Icon = getIconComponent(newSpaceIconName);
                              return <Icon className="h-5 w-5" />;
                            })()}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-auto p-1">
                          <IconPickerGrid onSelect={(name) => setNewSpaceIconName(name)} />
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        placeholder="e.g., User Guide, API Reference"
                        value={newSpaceName}
                        onChange={(e) => setNewSpaceName(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Input
                      id="description"
                      placeholder="Brief description of what this space contains"
                      value={newSpaceDescription}
                      onChange={(e) => setNewSpaceDescription(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowCreateForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={!newSpaceName.trim()}>
                      Create Space
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}

      {/* Spaces list */}
      <div className="space-y-1">
        {spaces.length === 0 ? (
          <div className={cn('px-3 py-4', collapsed && 'px-1 py-2')}>
            {collapsed ? (
              <div className="flex justify-center">
                <Hash className="text-muted-foreground h-4 w-4" />
              </div>
            ) : (
              <div className="text-center">
                <p className="text-muted-foreground text-sm">No spaces yet</p>
                {canCreateSpace && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    Create your first space to get started
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          spaces.map((space) => {
            const href = `/dashboard/${projectId}/spaces/${space.slug}`;
            const isActive = pathname.startsWith(href);

            return (
              <Link
                key={space._id}
                href={href}
                className={cn(
                  'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  collapsed ? 'mx-1 justify-center' : 'mx-2 gap-3',
                  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
                )}
              >
                <span className="text-base" title={space.name}>
                  {(() => {
                    const Icon = getIconComponent(space.iconName);
                    return <Icon className="h-4 w-4" />;
                  })()}
                </span>
                {!collapsed && (
                  <span className="truncate" title={space.name}>
                    {space.name}
                  </span>
                )}
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
