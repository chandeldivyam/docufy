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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertCircle,
  RotateCcw,
  ExternalLink,
  Copy,
  Globe,
  Loader2,
  Trash2,
  CheckCircle2,
  Info,
} from 'lucide-react';

type DomainVerificationStatus = {
  ok?: boolean;
  verified?: boolean;
  [key: string]: unknown;
};

const isDomainVerificationStatus = (value: unknown): value is DomainVerificationStatus => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if ('verified' in candidate && typeof candidate.verified !== 'boolean') return false;
  if ('ok' in candidate && typeof candidate.ok !== 'boolean') return false;
  return true;
};

export default function SitesPage() {
  const params = useParams();
  const projectId = params.projectId as Id<'projects'>;
  // Helper: Convex optimistic placeholders look like "optimistic:<something>"
  const isOptimisticId = (id: unknown) => String(id).startsWith('optimistic:');

  // Queries
  const site = useQueryWithStatus(api.sites.getByProject, { projectId });
  const spaces = useQueryWithStatus(api.spaces.list, { projectId });

  const builds = useQueryWithStatus(
    api.sites.listBuilds,
    site.data?._id && !isOptimisticId(site.data._id) ? { siteId: site.data._id } : 'skip',
  );

  // Mutations
  const updateSelection = useMutation(api.sites.updateSelection).withOptimisticUpdate(
    (store, { siteId, selectedSpaceIds }) => {
      const s = store.getQuery(api.sites.getByProject, { projectId });
      if (!s || s._id !== siteId) return;
      store.setQuery(
        api.sites.getByProject,
        { projectId },
        { ...s, selectedSpaceIds, updatedAt: Date.now() },
      );
    },
  );

  const createSite = useMutation(api.sites.create).withOptimisticUpdate((store, args) => {
    const now = Date.now();
    const optimistic = {
      _id: 'optimistic:site' as Id<'sites'>,
      _creationTime: now,
      projectId: args.projectId,
      storeId: args.storeId,
      baseUrl: args.baseUrl,
      selectedSpaceIds: [] as Id<'spaces'>[],
      createdAt: now,
      updatedAt: now,
      lastBuildId: undefined,
      lastPublishedAt: undefined,
    };
    store.setQuery(api.sites.getByProject, { projectId }, optimistic);
  });

  const publish = useAction(api.sites.publish);
  const revert = useAction(api.sites.revertToBuild);
  const connectDomain = useAction(api.sites.connectCustomDomain);
  const verifyDomain = useAction(api.sites.verifyCustomDomain);
  const disconnectDomain = useAction(api.sites.disconnectCustomDomain);

  // Local UI state
  const [selected, setSelected] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isReverting, setIsReverting] = useState<string | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const [verifying, setVerifying] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<Record<string, DomainVerificationStatus>>({});

  // Derive selection from server when local is empty
  const selectedSpaceIds = useMemo(() => {
    if (!site.data) return new Set<string>();
    return new Set<string>(site.data.selectedSpaceIds?.map(String) ?? []);
  }, [site.data]);

  function toggleSpace(sid: string) {
    const current = selected.length > 0 ? new Set(selected) : selectedSpaceIds;
    if (current.has(sid)) current.delete(sid);
    else current.add(sid);
    setSelected(Array.from(current));
  }

  function selectAll() {
    const all = (spaces.data ?? []).map((s) => String(s._id));
    setSelected(all);
  }
  function clearAll() {
    setSelected([]);
  }

  const currentBuild = useMemo(() => {
    const b = builds.data?.[0];
    return b && b.status !== 'success' && b.status !== 'failed' ? b : null;
  }, [builds.data]);

  const latestBuild = useMemo(() => builds.data?.[0] || null, [builds.data]);

  // DNS helper for UX
  const dns = useQueryWithStatus(
    api.sites.dnsInstructions,
    domainInput.trim() ? { domain: domainInput.trim() } : 'skip',
  );

  async function handleCreateSite() {
    setIsCreating(true);
    try {
      const storeId = process.env.NEXT_PUBLIC_VERCEL_BLOB_STORE_ID;
      const baseUrl = process.env.NEXT_PUBLIC_VERCEL_BLOB_BASE_URL;
      if (!storeId || !baseUrl) {
        toast.error('Missing storeId or baseUrl');
        return;
      }
      await createSite({ projectId, storeId, baseUrl });
      toast.success('Site created');
    } catch (e) {
      console.error(e);
      toast.error('Failed to create site');
    } finally {
      setIsCreating(false);
    }
  }

  async function handlePublish() {
    if (!site.data) return;
    setIsPublishing(true);
    try {
      const current = new Set<string>(
        selected.length > 0 ? selected : Array.from(selectedSpaceIds),
      );
      const server = new Set<string>((site.data.selectedSpaceIds ?? []).map(String));

      let changed = current.size !== server.size;
      if (!changed)
        for (const id of current)
          if (!server.has(id)) {
            changed = true;
            break;
          }

      if (changed) {
        await updateSelection({
          siteId: site.data._id,
          selectedSpaceIds: Array.from(current) as Id<'spaces'>[],
        });
      }

      await publish({ siteId: site.data._id });
      toast.success('Publish started');
    } catch (e) {
      console.error(e);
      toast.error('Failed to publish');
    } finally {
      setIsPublishing(false);
      setSelected([]);
    }
  }

  async function handleRevert(targetBuildId: string) {
    if (!site.data) return;
    setIsReverting(targetBuildId);
    try {
      await revert({ siteId: site.data._id, targetBuildId });
      toast.success(`Reverted to ${targetBuildId}`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to revert');
    } finally {
      setIsReverting(null);
    }
  }

  // Helpers
  function latestPointerUrl() {
    if (!site.data) return '';
    return `${site.data.baseUrl}/sites/${projectId}/latest.json`;
  }
  function buildTreeUrl(buildId: string) {
    if (!site.data) return '';
    return `${site.data.baseUrl}/sites/${projectId}/${buildId}/tree.json`;
  }
  function buildManifestUrl(buildId: string) {
    if (!site.data) return '';
    return `${site.data.baseUrl}/sites/${projectId}/${buildId}/manifest.json`;
  }

  function domainPointerUrl(host: string) {
    if (!site.data) return '';
    return `${site.data.baseUrl}/domains/${host}/latest.json`;
  }

  // ---- Domains UI handlers ----
  const addDomainMutation = useMutation(api.sites.addCustomDomain).withOptimisticUpdate(
    (store, { siteId, domain }) => {
      const s = store.getQuery(api.sites.getByProject, { projectId });
      if (!s || s._id !== siteId) return;
      const set = new Set([...(s.customDomains ?? []), domain.trim().toLowerCase()]);
      store.setQuery(
        api.sites.getByProject,
        { projectId },
        {
          ...s,
          customDomains: Array.from(set),
          updatedAt: Date.now(),
        },
      );
    },
  );

  const removeDomainMutation = useMutation(api.sites.removeCustomDomain).withOptimisticUpdate(
    (store, { siteId, domain }) => {
      const s = store.getQuery(api.sites.getByProject, { projectId });
      if (!s || s._id !== siteId) return;
      const next = (s.customDomains ?? []).filter((d) => d !== domain.trim().toLowerCase());
      store.setQuery(
        api.sites.getByProject,
        { projectId },
        {
          ...s,
          customDomains: next,
          updatedAt: Date.now(),
        },
      );
    },
  );

  async function handleConnectDomain() {
    if (!site.data) return;
    const d = domainInput.trim().toLowerCase();
    if (!d) return;
    try {
      setConnecting(true);
      // Optimistically add to UI
      await addDomainMutation({ siteId: site.data._id, domain: d });
      await connectDomain({ siteId: site.data._id, domain: d });
      toast.success(`Connected ${d}. DNS may take a few minutes.`);
      setDomainInput('');
    } catch (e) {
      console.error(e);
      toast.error('Failed to connect domain');
      // Roll back optimistic add
      try {
        await removeDomainMutation({ siteId: site.data._id, domain: d });
      } catch {
        toast.error('Failed to remove domain');
      }
    } finally {
      setConnecting(false);
    }
  }

  async function handleVerifyDomain(d: string) {
    if (!site.data) return;
    try {
      setVerifying(d);
      const res = await verifyDomain({ siteId: site.data._id, domain: d });
      const status: DomainVerificationStatus = isDomainVerificationStatus(res.status)
        ? res.status
        : { ok: true };
      setVerifyResult((prev) => ({ ...prev, [d]: status }));
      if (status.verified === true) toast.success(`${d} is verified`);
      else toast(`${d} not verified yet`, { description: 'Update DNS and try again.' });
    } catch (e) {
      console.error(e);
      toast.error('Verification failed');
    } finally {
      setVerifying(null);
    }
  }

  async function handleRemoveDomain(d: string) {
    if (!site.data) return;
    try {
      setRemoving(d);
      await removeDomainMutation({ siteId: site.data._id, domain: d });
      await disconnectDomain({ siteId: site.data._id, domain: d });
      toast.success(`Removed ${d}`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to remove domain');
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Site Publishing</h1>
        {site.data && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(latestPointerUrl());
                toast.success('Latest pointer URL copied');
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy latest pointer URL
            </Button>
            <a href={latestPointerUrl()} target="_blank" rel="noreferrer" className="inline-flex">
              <Button variant="outline">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open latest.json
              </Button>
            </a>
          </div>
        )}
      </div>

      {/* Create site */}
      {site.status === 'success' && !site.data && (
        <Card>
          <CardHeader>
            <CardTitle>Create your first site</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Create a site, then choose which spaces to include and click Publish.
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={handleCreateSite} disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create site'}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Main interface */}
      {site.data && (
        <>
          {/* Domains & routing */}
          <Card>
            <CardHeader>
              <CardTitle>Domains & routing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <div className="text-sm font-medium">Primary subdomain</div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Globe className="text-muted-foreground h-4 w-4" />
                  {site.data.primaryHost ? (
                    <>
                      <code>{site.data.primaryHost}</code>
                      <a
                        href={`https://${site.data.primaryHost}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex"
                      >
                        <Button size="sm" variant="outline">
                          <ExternalLink className="mr-2 h-4 w-4" /> Open
                        </Button>
                      </a>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const url = domainPointerUrl(site.data!.primaryHost!);
                          navigator.clipboard.writeText(url);
                          toast.success('Copied alias pointer URL');
                        }}
                      >
                        <Copy className="mr-2 h-4 w-4" /> Copy pointer URL
                      </Button>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Pending…</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="domain">Add a custom domain</Label>
                <div className="flex gap-2">
                  <Input
                    id="domain"
                    placeholder="docs.yourdomain.com"
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleConnectDomain();
                    }}
                  />
                  <Button onClick={handleConnectDomain} disabled={!domainInput || connecting}>
                    {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Connect
                  </Button>
                </div>
                {/* DNS guidance */}
                {domainInput && (
                  <div className="text-muted-foreground text-xs">
                    {dns.isPending ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Checking…
                      </span>
                    ) : dns.isError ? null : dns.data ? (
                      <div className="flex items-start gap-2">
                        <Info className="mt-0.5 h-3.5 w-3.5" />
                        <div>
                          {dns.data.kind === 'subdomain' ? (
                            <span>
                              Create a CNAME <code>{domainInput.split('.')[0]}</code> →{' '}
                              <code>{dns.data.target}</code>
                            </span>
                          ) : (
                            <span>
                              At the apex, create A/AAAA records to Vercel’s Anycast IPs shown in
                              your project’s Domains tab.
                            </span>
                          )}
                          {dns.data.notes?.length ? (
                            <ul className="mt-1 list-disc pl-4">
                              {dns.data.notes.map((n: string, i: number) => (
                                <li key={i}>{n}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Connected custom domains</div>
                {(site.data.customDomains ?? []).length === 0 ? (
                  <div className="text-muted-foreground text-sm">No custom domains yet</div>
                ) : (
                  <div className="divide-y rounded-md border">
                    {(site.data.customDomains ?? []).map((d) => {
                      const v = verifyResult[d];
                      const verified =
                        v?.verified === true || v?.configured === true || v?.ready === true;
                      return (
                        <div
                          key={d}
                          className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Globe className="text-muted-foreground h-4 w-4" />
                              <code className="truncate">{d}</code>
                              {verified ? (
                                <Badge
                                  variant="secondary"
                                  className="inline-flex items-center gap-1"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                                </Badge>
                              ) : null}
                            </div>
                            <div className="text-muted-foreground mt-1 text-xs">
                              Alias pointer:{' '}
                              <a
                                href={domainPointerUrl(d)}
                                target="_blank"
                                rel="noreferrer"
                                className="underline-offset-2 hover:underline"
                              >
                                {domainPointerUrl(d)}
                              </a>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <a href={`https://${d}`} target="_blank" rel="noreferrer">
                              <Button size="sm" variant="outline">
                                <ExternalLink className="mr-2 h-4 w-4" /> Open
                              </Button>
                            </a>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleVerifyDomain(d)}
                              disabled={verifying === d}
                            >
                              {verifying === d ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : null}
                              Check verification
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveDomain(d)}
                              disabled={removing === d}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {removing === d ? 'Removing…' : 'Remove'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Spaces to publish</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {spaces.isPending ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-72" />
                  <Skeleton className="h-4 w-52" />
                </div>
              ) : spaces.isError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="mt-2">Failed to load spaces</AlertDescription>
                </Alert>
              ) : (spaces.data?.length ?? 0) === 0 ? (
                <div className="text-muted-foreground text-sm">No spaces yet</div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAll}>
                      Select all
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearAll}>
                      Clear all
                    </Button>
                  </div>
                  {(spaces.data ?? []).map((s) => {
                    const checked =
                      selected.length > 0
                        ? selected.includes(String(s._id))
                        : selectedSpaceIds.has(String(s._id));
                    return (
                      <label key={String(s._id)} className="flex items-center gap-2">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleSpace(String(s._id))}
                        />
                        <span>{s.name}</span>
                      </label>
                    );
                  })}
                </>
              )}
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button onClick={handlePublish} disabled={!!currentBuild || isPublishing}>
                {isPublishing ? 'Publishing…' : 'Publish'}
              </Button>
            </CardFooter>
          </Card>

          {/* Live build status */}
          <Card>
            <CardHeader>
              <CardTitle>Build status</CardTitle>
            </CardHeader>
            <CardContent>
              {builds.isPending ? (
                <div className="text-muted-foreground text-sm">Loading builds…</div>
              ) : builds.isError ? (
                <div className="text-red-500">Failed to load builds</div>
              ) : currentBuild ? (
                <div className="space-y-2">
                  <div className="text-sm">
                    Status: <strong>{currentBuild.status}</strong> • Build {currentBuild.buildId}
                  </div>
                  <Progress
                    value={
                      currentBuild.itemsTotal > 0
                        ? Math.floor((currentBuild.itemsDone / currentBuild.itemsTotal) * 100)
                        : 2
                    }
                  />
                  <div className="text-muted-foreground text-xs">
                    {currentBuild.itemsDone} of {currentBuild.itemsTotal}{' '}
                    {currentBuild.operation === 'publish' ? 'pages' : 'items'}
                  </div>
                </div>
              ) : latestBuild ? (
                <div className="text-sm">
                  Latest build {latestBuild.buildId} - <strong>{latestBuild.status}</strong>
                </div>
              ) : (
                <div className="text-muted-foreground text-sm">No publishes yet</div>
              )}
            </CardContent>
          </Card>

          {/* History - all builds */}
          <Card>
            <CardHeader>
              <CardTitle>Publish history</CardTitle>
            </CardHeader>
            <CardContent>
              {builds.data && builds.data.length > 0 ? (
                <div className="divide-y">
                  {builds.data.map((b) => (
                    <div key={b.buildId} className="flex items-center justify-between py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-xs">{b.buildId}</code>
                          <Badge
                            variant={
                              b.status === 'success'
                                ? 'secondary'
                                : b.status === 'failed'
                                  ? 'destructive'
                                  : 'default'
                            }
                          >
                            {b.status}
                          </Badge>
                          <Badge variant="outline">
                            {b.operation === 'revert'
                              ? `revert → ${b.targetBuildId?.slice(-6) ?? ''}`
                              : 'publish'}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground mt-1 text-xs">
                          Started {new Date(b.startedAt).toLocaleString()}
                          {b.finishedAt
                            ? ` • Finished ${new Date(b.finishedAt).toLocaleString()}`
                            : ''}
                          {b.itemsTotal
                            ? ` • ${b.operation === 'publish' ? 'Pages' : 'Items'} ${b.itemsDone}/${b.itemsTotal}`
                            : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a href={buildTreeUrl(b.buildId)} target="_blank" rel="noreferrer">
                          <Button variant="outline" size="sm">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Tree
                          </Button>
                        </a>
                        <a href={buildManifestUrl(b.buildId)} target="_blank" rel="noreferrer">
                          <Button variant="outline" size="sm">
                            Manifest
                          </Button>
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={
                            b.status !== 'success' ||
                            b.operation === 'revert' ||
                            isReverting === b.buildId ||
                            !!currentBuild
                          }
                          onClick={() => handleRevert(b.buildId)}
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          {isReverting === b.buildId ? 'Reverting…' : 'Revert to this'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground text-sm">No history yet</div>
              )}
            </CardContent>
          </Card>

          {site.isPending && <div>Loading site configuration…</div>}
          {site.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="mt-2">
                Failed to load site configuration
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}
