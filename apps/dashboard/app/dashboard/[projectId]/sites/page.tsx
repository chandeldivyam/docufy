// apps/dashboard/app/dashboard/[projectId]/sites/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useQueryWithStatus } from '@/lib/convexHooks';
import { api } from '@/convex/_generated/api';
import { useMutation, useAction } from 'convex/react';
import { useState, useMemo } from 'react';
import type { Id } from '@/convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

export default function SitesPage() {
  const params = useParams();
  const projectId = params.projectId as Id<'projects'>;

  // Just get the site (no auto-creation)
  const site = useQueryWithStatus(api.sites.getByProject, { projectId });

  const spaces = useQueryWithStatus(api.spaces.list, { projectId });

  const builds = useQueryWithStatus(
    api.sites.listBuilds,
    site.data?._id ? { siteId: site.data._id } : 'skip',
  );

  const createSite = useMutation(api.sites.create);
  const updateSelection = useMutation(api.sites.updateSelection);
  const publish = useAction(api.sites.publish);

  const [selected, setSelected] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Get the latest build (first in array since ordered desc)
  const latestBuild = useMemo(() => {
    return builds.data?.[0] || null;
  }, [builds.data]);

  // Check if there's a currently running build
  const currentBuild = useMemo(() => {
    const b = builds.data?.[0];
    return b && b.status !== 'success' && b.status !== 'failed' ? b : null;
  }, [builds.data]);

  // Synchronize selection when both site and spaces are loaded
  const selectedSpaceIds = useMemo(() => {
    if (!site.data) return new Set<string>();
    return new Set<string>(site.data.selectedSpaceIds?.map(String) ?? []);
  }, [site.data]);

  function toggle(sid: string) {
    // Use current selection state, fallback to saved state
    const currentSelection = selected.length > 0 ? new Set(selected) : selectedSpaceIds;

    if (currentSelection.has(sid)) {
      currentSelection.delete(sid);
    } else {
      currentSelection.add(sid);
    }
    setSelected(Array.from(currentSelection));
  }

  async function handleCreateSite() {
    setIsCreating(true);
    try {
      // TODO: Replace these with your actual store configuration
      // These should come from environment variables or project settings
      const storeId = process.env.NEXT_PUBLIC_VERCEL_BLOB_STORE_ID;
      const baseUrl = process.env.NEXT_PUBLIC_VERCEL_BLOB_BASE_URL;

      if (!storeId || !baseUrl) {
        toast.error('Missing storeId or baseUrl');
        return;
      }

      await createSite({
        projectId,
        storeId,
        baseUrl,
      });
      toast.success('Site created successfully');
    } catch (e) {
      console.error(e);
      toast.error(`Failed to create site:`);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSaveSelection() {
    if (!site.data) return;
    try {
      await updateSelection({
        siteId: site.data._id,
        selectedSpaceIds: (selected.length
          ? selected
          : Array.from(selectedSpaceIds)) as Id<'spaces'>[],
      });
      toast.success('Selection saved');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save selection');
    }
  }

  async function handlePublish() {
    if (!site.data) return;
    try {
      await publish({ siteId: site.data._id });
      toast.success('Publish started');
    } catch (e) {
      console.error(e);
      toast.error('Failed to start publish');
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Site Publishing</h1>

      {/* Show create site card if no site exists */}
      {site.status === 'success' && !site.data && (
        <Card>
          <CardHeader>
            <CardTitle>Create your first site</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You need to create a site before you can publish your content.
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={handleCreateSite} disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Site'}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Show main interface only if site exists */}
      {site.data && (
        <>
          {/* Site configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Spaces to publish</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {spaces.isPending ? (
                <div>Loading spaces…</div>
              ) : spaces.isError ? (
                <div className="text-red-500">Failed to load spaces</div>
              ) : (
                spaces.data?.map((s) => {
                  const checked =
                    selected.length > 0
                      ? selected.includes(String(s._id))
                      : selectedSpaceIds.has(String(s._id));
                  return (
                    <label key={String(s._id)} className="flex items-center gap-2">
                      <Checkbox checked={checked} onCheckedChange={() => toggle(String(s._id))} />
                      <span>{s.name}</span>
                    </label>
                  );
                })
              )}
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button variant="outline" onClick={handleSaveSelection}>
                Save selection
              </Button>
              <Button onClick={handlePublish} disabled={!!currentBuild}>
                Publish
              </Button>
            </CardFooter>
          </Card>

          {/* Build status */}
          <Card>
            <CardHeader>
              <CardTitle>Latest publish</CardTitle>
            </CardHeader>
            <CardContent>
              {latestBuild ? (
                <div className="space-y-2">
                  <div className="text-sm">
                    Status: <strong>{latestBuild.status}</strong>
                  </div>
                  {latestBuild.status === 'running' && (
                    <>
                      <Progress
                        value={
                          latestBuild.itemsTotal > 0
                            ? Math.floor((latestBuild.itemsDone / latestBuild.itemsTotal) * 100)
                            : 2
                        }
                      />
                      <div className="text-muted-foreground text-xs">
                        {latestBuild.itemsDone} / {latestBuild.itemsTotal} pages
                      </div>
                    </>
                  )}
                  {latestBuild.status === 'success' && (
                    <div className="text-sm text-green-700">
                      Published build {latestBuild.buildId} at{' '}
                      {new Date(latestBuild.finishedAt!).toLocaleString()}
                    </div>
                  )}
                  {latestBuild.status === 'failed' && (
                    <div className="text-sm text-red-600">
                      Failed: {latestBuild.error ?? 'Unknown error'}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-muted-foreground text-sm">No publishes yet</div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Loading and error states */}
      {site.isPending && <div>Loading site configuration…</div>}
      {site.isError && <div className="text-red-500">Failed to load site configuration</div>}
    </div>
  );
}
