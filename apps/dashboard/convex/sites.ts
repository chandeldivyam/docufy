// apps/dashboard/convex/sites.ts
import { v } from 'convex/values';
import { action, mutation, query } from './_generated/server';
import { assertMembership } from './_utils/auth';
import { appError } from './_utils/errors';
import type { Id } from './_generated/dataModel';
import { api, internal } from './_generated/api';

// Node-only helpers and internal actions moved to sites.node.ts

// -------------------- Public mutations/queries --------------------

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 48);
}

function allocatePrimaryHost(projectName: string) {
  const slug = slugify(projectName) || 'site';
  const rand = Math.random().toString(16).slice(2, 8);
  return `${slug}-${rand}.trydocufy.com`;
}

export const create = mutation({
  args: {
    projectId: v.id('projects'),
    storeId: v.string(),
    baseUrl: v.string(),
  },
  handler: async (ctx, { projectId, storeId, baseUrl }) => {
    await assertMembership(ctx, projectId);

    const project = await ctx.db.get(projectId);
    if (!project) throw appError('PROJECT_NOT_FOUND');

    const existing = await ctx.db
      .query('sites')
      .withIndex('by_project', (q) => q.eq('projectId', projectId))
      .first();
    if (existing) throw appError('SITE_ALREADY_EXISTS', 'Site already exists for this project');

    const primaryHost = allocatePrimaryHost(project.name);

    const id = await ctx.db.insert('sites', {
      projectId,
      storeId,
      baseUrl,
      selectedSpaceIds: [],
      primaryHost,
      customDomains: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return await ctx.db.get(id);
  },
});

export const getOrCreateForProject = mutation({
  args: {
    projectId: v.id('projects'),
    storeId: v.optional(v.string()),
    baseUrl: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, storeId, baseUrl }) => {
    await assertMembership(ctx, projectId);
    const existing = await ctx.db
      .query('sites')
      .withIndex('by_project', (q) => q.eq('projectId', projectId))
      .first();
    if (existing) return existing;

    if (!storeId || !baseUrl)
      throw appError('SITE_MISSING_STORE', 'Vercel Blob store not configured');
    const project = await ctx.db.get(projectId);
    if (!project) throw appError('PROJECT_NOT_FOUND');
    const primaryHost = allocatePrimaryHost(project.name);
    const id = await ctx.db.insert('sites', {
      projectId,
      storeId,
      baseUrl,
      selectedSpaceIds: [],
      primaryHost,
      customDomains: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return await ctx.db.get(id);
  },
});

export const getByProject = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, { projectId }) => {
    await assertMembership(ctx, projectId);
    return await ctx.db
      .query('sites')
      .withIndex('by_project', (q) => q.eq('projectId', projectId))
      .first();
  },
});

export const updateSelection = mutation({
  args: {
    siteId: v.id('sites'),
    selectedSpaceIds: v.array(v.id('spaces')),
  },
  handler: async (ctx, { siteId, selectedSpaceIds }) => {
    const site = await ctx.db.get(siteId);
    if (!site) throw appError('SITE_NOT_FOUND');
    await assertMembership(ctx, site.projectId, ['owner', 'admin', 'editor']);
    await ctx.db.patch(siteId, { selectedSpaceIds, updatedAt: Date.now() });
  },
});

export const listBuilds = query({
  args: { siteId: v.id('sites') },
  handler: async (ctx, { siteId }) => {
    const site = await ctx.db.get(siteId);
    if (!site) throw appError('SITE_NOT_FOUND');
    await assertMembership(ctx, site.projectId);
    return await ctx.db
      .query('siteBuilds')
      .withIndex('by_site', (q) => q.eq('siteId', siteId))
      .order('desc')
      .collect();
  },
});

// Helper: fetch a build by site + buildId (for actions)
export const getBuildById = query({
  args: { siteId: v.id('sites'), buildId: v.string() },
  handler: async (ctx, { siteId, buildId }) => {
    return await ctx.db
      .query('siteBuilds')
      .withIndex('by_build_id', (q) => q.eq('buildId', buildId))
      .filter((q) => q.eq(q.field('siteId'), siteId))
      .first();
  },
});

// --- Build bookkeeping helpers (queries/mutations) ---

export const getSite = query({
  args: { siteId: v.id('sites') },
  handler: async (ctx, { siteId }) => ctx.db.get(siteId),
});

export const listByProject = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, { projectId }) => {
    await assertMembership(ctx, projectId);
    return await ctx.db
      .query('sites')
      .withIndex('by_project', (q) => q.eq('projectId', projectId))
      .collect();
  },
});

export const assertProjectAccess = query({
  args: { siteId: v.id('sites') },
  handler: async (ctx, { siteId }) => {
    const site = await ctx.db.get(siteId);
    if (!site) throw appError('SITE_NOT_FOUND');
    await assertMembership(ctx, site.projectId);
  },
});

export const _startBuild = mutation({
  args: {
    siteId: v.id('sites'),
    buildId: v.string(),
    operation: v.union(v.literal('publish'), v.literal('revert')),
    actorUserId: v.id('users'),
    selectedSpaceIdsSnapshot: v.array(v.id('spaces')),
    targetBuildId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('siteBuilds', {
      siteId: args.siteId,
      buildId: args.buildId,
      status: 'running',
      startedAt: Date.now(),
      itemsTotal: 0,
      itemsDone: 0,
      pagesWritten: 0,
      bytesWritten: 0,
      operation: args.operation,
      actorUserId: args.actorUserId,
      selectedSpaceIdsSnapshot: args.selectedSpaceIdsSnapshot,
      targetBuildId: args.targetBuildId,
    });
    return id;
  },
});

export const _updateProgress = mutation({
  args: {
    siteId: v.id('sites'),
    buildId: v.string(),
    deltaItems: v.number(),
    deltaPages: v.number(),
    deltaBytes: v.number(),
    itemsTotal: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db
      .query('siteBuilds')
      .withIndex('by_build_id', (q) => q.eq('buildId', args.buildId))
      .first();
    if (!build) return;
    await ctx.db.patch(build._id, {
      itemsDone: build.itemsDone + args.deltaItems,
      pagesWritten: build.pagesWritten + args.deltaPages,
      bytesWritten: build.bytesWritten + args.deltaBytes,
      ...(args.itemsTotal !== undefined ? { itemsTotal: args.itemsTotal } : {}),
    });
  },
});

export const _finishBuild = mutation({
  args: {
    buildId: v.string(),
    status: v.union(v.literal('success'), v.literal('failed')),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { buildId, status, error }) => {
    const build = await ctx.db
      .query('siteBuilds')
      .withIndex('by_build_id', (q) => q.eq('buildId', buildId))
      .first();
    if (!build) return;

    await ctx.db.patch(build._id, {
      status,
      finishedAt: Date.now(),
      ...(error ? { error } : {}),
    });

    if (status === 'success') {
      const site = await ctx.db.get(build.siteId);
      if (site) {
        await ctx.db.patch(site._id, {
          lastBuildId: build.buildId,
          lastPublishedAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }
  },
});

// --- Content-blob helpers (hash-indexed) ---

export const _getBlobByHash = query({
  args: { projectId: v.id('projects'), hash: v.string() },
  handler: async (ctx, { projectId, hash }) => {
    return await ctx.db
      .query('siteContentBlobs')
      .withIndex('by_project_hash', (q) => q.eq('projectId', projectId).eq('hash', hash))
      .first();
  },
});

export const _recordBlobIfMissing = mutation({
  args: {
    projectId: v.id('projects'),
    hash: v.string(),
    key: v.string(),
    size: v.number(),
  },
  handler: async (ctx, { projectId, hash, key, size }) => {
    const existing = await ctx.db
      .query('siteContentBlobs')
      .withIndex('by_project_hash', (q) => q.eq('projectId', projectId).eq('hash', hash))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        lastUsedAt: now,
        refCount: (existing.refCount ?? 1) + 1,
      });
      return existing;
    }
    const id = await ctx.db.insert('siteContentBlobs', {
      projectId,
      hash,
      key,
      size,
      createdAt: now,
      lastUsedAt: now,
      refCount: 1,
    });
    return await ctx.db.get(id);
  },
});

// -------------------- Domain bindings --------------------

export const addCustomDomain = mutation({
  args: { siteId: v.id('sites'), domain: v.string() },
  handler: async (ctx, { siteId, domain }) => {
    const site = await ctx.db.get(siteId);
    if (!site) throw appError('SITE_NOT_FOUND');
    await assertMembership(ctx, site.projectId, ['owner', 'admin', 'editor']);

    const d = domain.trim().toLowerCase();
    if (!/^[a-z0-9.-]+$/.test(d)) throw appError('INVALID_DOMAIN');
    const updated = Array.from(new Set([...(site.customDomains ?? []), d]));
    await ctx.db.patch(siteId, { customDomains: updated, updatedAt: Date.now() });
  },
});

export const removeCustomDomain = mutation({
  args: { siteId: v.id('sites'), domain: v.string() },
  handler: async (ctx, { siteId, domain }) => {
    const site = await ctx.db.get(siteId);
    if (!site) throw appError('SITE_NOT_FOUND');
    await assertMembership(ctx, site.projectId, ['owner', 'admin', 'editor']);

    const d = domain.trim().toLowerCase();
    const updated = (site.customDomains ?? []).filter((x) => x !== d);
    await ctx.db.patch(siteId, { customDomains: updated, updatedAt: Date.now() });
  },
});

// -------------------- Publish entrypoints --------------------

export const publish = action({
  args: { siteId: v.id('sites') },
  handler: async (ctx, { siteId }) => {
    const site = await ctx.runQuery(api.sites.getSite, { siteId });
    if (!site) throw appError('SITE_NOT_FOUND');
    await ctx.runQuery(api.sites.assertProjectAccess, { siteId });

    const me = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!me) throw appError('UNAUTHORIZED');

    const buildId = Date.now().toString(36);

    await ctx.runMutation(api.sites._startBuild, {
      siteId,
      buildId,
      operation: 'publish',
      actorUserId: me._id,
      selectedSpaceIdsSnapshot: site.selectedSpaceIds,
      targetBuildId: undefined,
    });

    try {
      await ctx.runAction(internal.sitesNode._doPublish, { siteId, buildId });
      await ctx.runMutation(api.sites._finishBuild, { buildId, status: 'success' });
    } catch (e) {
      await ctx.runMutation(api.sites._finishBuild, {
        buildId,
        status: 'failed',
        error: e instanceof Error ? e.message : 'Unknown error',
      });
      throw e;
    }
    return { buildId };
  },
});

// (Node worker moved to apps/dashboard/convex/sites.node.ts)

// -------------------- Revert: pointer flip only --------------------

export const revertToBuild = action({
  args: { siteId: v.id('sites'), targetBuildId: v.string() },
  handler: async (ctx, { siteId, targetBuildId }) => {
    const site = await ctx.runQuery(api.sites.getSite, { siteId });
    if (!site) throw appError('SITE_NOT_FOUND');
    await ctx.runQuery(api.sites.assertProjectAccess, { siteId });

    const me = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!me) throw appError('UNAUTHORIZED');

    // Validate target: must be a successful publish build; prevent revert→revert
    const target = await ctx.runQuery(api.sites.getBuildById, {
      siteId: site._id,
      buildId: targetBuildId,
    });
    if (!target || target.status !== 'success' || target.operation !== 'publish') {
      throw appError('INVALID_REVERT_TARGET', 'You can only revert to a successful publish build');
    }

    // Treat revert as its own build for history, but upload nothing.
    const buildId = Date.now().toString(36);
    await ctx.runMutation(api.sites._startBuild, {
      siteId,
      buildId,
      operation: 'revert',
      actorUserId: me._id,
      selectedSpaceIdsSnapshot: site.selectedSpaceIds,
      targetBuildId,
    });

    try {
      await ctx.runAction(internal.sitesNode._revertPointer, {
        projectId: site.projectId as Id<'projects'>,
        baseUrl: site.baseUrl as string,
        buildId,
        targetBuildId,
      });
      await ctx.runMutation(api.sites._finishBuild, { buildId, status: 'success' });
    } catch (e) {
      await ctx.runMutation(api.sites._finishBuild, {
        buildId,
        status: 'failed',
        error: e instanceof Error ? e.message : 'Unknown error',
      });
      throw e;
    }

    return { buildId, revertedTo: targetBuildId };
  },
});

// Optional: Keep referenced blobs fresh on revert so GC doesn’t purge them
export const _touchBlobs = mutation({
  args: { projectId: v.id('projects'), hashes: v.array(v.string()) },
  handler: async (ctx, { projectId, hashes }) => {
    const now = Date.now();
    for (const hash of hashes) {
      const rec = await ctx.db
        .query('siteContentBlobs')
        .withIndex('by_project_hash', (q) => q.eq('projectId', projectId).eq('hash', hash))
        .first();
      if (rec) {
        await ctx.db.patch(rec._id, {
          lastUsedAt: now,
          refCount: (rec.refCount ?? 1) + 1,
        });
      }
    }
  },
});
