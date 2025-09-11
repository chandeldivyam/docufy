// apps/dashboard/convex/sites.ts
import { v } from 'convex/values';
import { action, internalAction, mutation, query } from './_generated/server';
import { assertMembership } from './_utils/auth';
import { appError } from './_utils/errors';
import type { Id } from './_generated/dataModel';
import { put } from '@vercel/blob';
import { api, internal } from './_generated/api';
import { serialize as serializeContent } from '@docufy/content-kit/renderer';
import { JSONContent } from '@tiptap/core';

// Define proper types for document tree structure
interface DocumentTreeNode {
  _id: Id<'documents'>;
  type: 'page' | 'group';
  title: string;
  slug: string;
  iconName?: string;
  children?: DocumentTreeNode[];
}

// Define interface for space with tree
interface SpaceWithTree {
  space: {
    _id: Id<'spaces'>;
    name: string;
    slug: string;
    iconName?: string;
  };
  tree: DocumentTreeNode[];
}

export const create = mutation({
  args: {
    projectId: v.id('projects'),
    storeId: v.string(),
    baseUrl: v.string(),
  },
  handler: async (ctx, { projectId, storeId, baseUrl }) => {
    await assertMembership(ctx, projectId);

    // Check if site already exists
    const existing = await ctx.db
      .query('sites')
      .withIndex('by_project', (q) => q.eq('projectId', projectId))
      .first();
    if (existing) throw appError('SITE_ALREADY_EXISTS', 'Site already exists for this project');

    const id = await ctx.db.insert('sites', {
      projectId,
      storeId,
      baseUrl,
      selectedSpaceIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return await ctx.db.get(id);
  },
});

export const getOrCreateForProject = mutation({
  args: {
    projectId: v.id('projects'),
    // allow setting once; you already have these constants:
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
    const id = await ctx.db.insert('sites', {
      projectId,
      storeId,
      baseUrl,
      selectedSpaceIds: [],
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
    const allBuilds = await ctx.db
      .query('siteBuilds')
      .withIndex('by_site', (q) => q.eq('siteId', siteId))
      .order('desc')
      .collect();
    return allBuilds;
  },
});

export const publish = action({
  args: {
    siteId: v.id('sites'),
  },
  handler: async (ctx, { siteId }) => {
    // Load site + project guard
    const site = await ctx.runQuery(api.sites.getSite, { siteId });
    if (!site) throw appError('SITE_NOT_FOUND');
    await ctx.runQuery(api.sites.assertProjectAccess, { siteId });

    const buildId = Date.now().toString(36);
    await ctx.runMutation(api.sites._startBuild, { siteId, buildId });

    try {
      await ctx.runAction(internal.sites._doPublish, { siteId, buildId });
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

// Helpers as queries/mutations to keep state changes deterministic
export const getSite = query({
  args: { siteId: v.id('sites') },
  handler: async (ctx, { siteId }) => ctx.db.get(siteId),
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
  args: { siteId: v.id('sites'), buildId: v.string() },
  handler: async (ctx, { siteId, buildId }) => {
    const id = await ctx.db.insert('siteBuilds', {
      siteId,
      buildId,
      status: 'running',
      startedAt: Date.now(),
      itemsTotal: 0,
      itemsDone: 0,
      pagesWritten: 0,
      bytesWritten: 0,
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
      .withIndex('by_site', (q) => q.eq('siteId', args.siteId))
      .order('desc')
      .first();
    if (!build || build.buildId !== args.buildId) return;

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
      .filter((q) => q.eq(q.field('buildId'), buildId))
      .first();
    if (!build) return;
    await ctx.db.patch(build._id, { status, finishedAt: Date.now(), ...(error ? { error } : {}) });

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

// The worker that does the actual publish (Node action calling external APIs)
export const _doPublish = internalAction({
  args: { siteId: v.id('sites'), buildId: v.string() },
  handler: async (ctx, { siteId, buildId }) => {
    const site = await ctx.runQuery(api.sites.getSite, { siteId });
    if (!site) throw new Error('Site not found');

    // 1) Load selected spaces and assemble trees
    const spaces = await ctx.runQuery(api.spaces.list, { projectId: site.projectId });
    const selected = spaces.filter((s) =>
      site.selectedSpaceIds.some((id) => String(id) === String(s._id)),
    );

    // Gather trees for each space
    const trees: SpaceWithTree[] = [];
    for (const s of selected) {
      const tree = await ctx.runQuery(api.documents.getTreeForSpace, { spaceId: s._id });
      trees.push({ space: { _id: s._id, name: s.name, slug: s.slug, iconName: s.iconName }, tree });
    }

    // 2) Flatten pages to compute totals
    const pages: Array<{
      id: Id<'documents'>;
      slug: string;
      pmsDocKey?: string;
      title: string;
      path: string[];
      iconName?: string;
    }> = [];

    function walk(spaceSlug: string, node: DocumentTreeNode, parents: DocumentTreeNode[] = []) {
      const path = parents.map((p) => p.slug).concat(node.slug);
      if (node.type === 'page') {
        pages.push({
          id: node._id,
          slug: node.slug,
          pmsDocKey: (node as DocumentTreeNode & { pmsDocKey?: string }).pmsDocKey,
          title: node.title,
          path,
          iconName: node.iconName,
        });
      }
      for (const child of node.children ?? []) walk(spaceSlug, child, parents.concat(node));
    }
    for (const { space, tree } of trees) for (const n of tree) walk(space.slug, n, []);

    await ctx.runMutation(api.sites._updateProgress, {
      siteId,
      buildId,
      deltaItems: 0,
      deltaPages: 0,
      deltaBytes: 0,
      itemsTotal: pages.length,
    });

    // 3) Write tree.json (renderer boots from this)
    const treePayload = {
      projectId: site.projectId,
      buildId,
      publishedAt: Date.now(),
      spaces: trees.map(({ space, tree }) => ({ space, tree })),
    };
    const treeKey = `sites/${site.projectId}/${buildId}/tree.json`;
    await put(treeKey, JSON.stringify(treePayload), {
      access: 'public',
      contentType: 'application/json',
      cacheControlMaxAge: 31536000,
      addRandomSuffix: false,
    });

    // 4) Export each page's ProseMirror snapshot and text
    for (const p of pages) {
      // backfill docKey if missing
      const docKey =
        p.pmsDocKey ??
        `space/${String(site.projectId) /* not ideal, but fine for backfill */}/doc/${p.id}`;
      // Ask editor component for latest version + snapshot
      // latestVersion returns number | null
      const latest = await ctx.runQuery(api.editor.latestVersion, { id: docKey });
      let pmDoc: JSONContent | null = null;
      if (latest !== null) {
        const snap = await ctx.runQuery(api.editor.getSnapshot, { id: docKey, version: latest });
        // @convex-dev/prosemirror-sync returns { content: string | null, version }
        if ('content' in snap && snap.content) {
          pmDoc = JSON.parse(snap.content) as JSONContent;
        }
      }

      const pmJson = JSON.stringify({
        documentId: p.id,
        title: p.title,
        slug: p.slug,
        iconName: p.iconName,
        path: p.path, // [groupSlug?, subGroupSlug?, pageSlug...]
        pm: pmDoc, // could be null if empty
        version: latest ?? 0,
      });

      const pmKey = `sites/${site.projectId}/${buildId}/docs/${p.id}.pm.json`;
      await put(pmKey, pmJson, {
        access: 'public',
        contentType: 'application/json',
        cacheControlMaxAge: 31536000,
        addRandomSuffix: false,
      });

      // Plain text for search bootstrap (quick heuristic)
      const plain = extractPlainTextFromPm(pmDoc);
      const txtKey = `sites/${site.projectId}/${buildId}/docs/${p.id}.txt`;
      await put(txtKey, plain, {
        access: 'public',
        contentType: 'text/plain',
        cacheControlMaxAge: 31536000,
        addRandomSuffix: false,
      });

      const { html, toc } = serializeContent(pmDoc ?? {});
      const htmlKey = `sites/${site.projectId}/${buildId}/docs/${p.id}.html`;
      await put(htmlKey, html, {
        access: 'public',
        contentType: 'text/html',
        cacheControlMaxAge: 31536000,
        addRandomSuffix: false,
      });

      const tocKey = `sites/${site.projectId}/${buildId}/docs/${p.id}.toc.json`;
      await put(tocKey, JSON.stringify(toc), {
        access: 'public',
        contentType: 'application/json',
        cacheControlMaxAge: 31536000,
        addRandomSuffix: false,
      });

      await ctx.runMutation(api.sites._updateProgress, {
        siteId,
        buildId,
        deltaItems: 1,
        deltaPages: 1,
        deltaBytes: pmJson.length + plain.length,
      });
    }

    // 5) manifest.json
    const manifest = {
      projectId: site.projectId,
      siteId,
      buildId,
      publishedAt: Date.now(),
      counts: { pages: pages.length },
      spacesPublished: selected.map((s) => ({ _id: s._id, slug: s.slug, name: s.name })),
      contentVersion: 'pm-v1',
    };
    await put(`sites/${site.projectId}/${buildId}/manifest.json`, JSON.stringify(manifest), {
      access: 'public',
      contentType: 'application/json',
      cacheControlMaxAge: 31536000,
      addRandomSuffix: false,
    });

    // 6) Update "latest.json" pointer (no-cache)
    await put(
      `sites/${site.projectId}/latest.json`,
      JSON.stringify({
        buildId,
        treeUrl: `${site.baseUrl}/sites/${site.projectId}/${buildId}/tree.json`,
        manifestUrl: `${site.baseUrl}/sites/${site.projectId}/${buildId}/manifest.json`,
      }),
      {
        access: 'public',
        contentType: 'application/json',
        cacheControlMaxAge: 0, // make it revalidate each view
        addRandomSuffix: false,
        allowOverwrite: true,
      },
    );
  },
});

// Small utility to approximate plain text from a PM doc
function extractPlainTextFromPm(pm: JSONContent | null): string {
  if (!pm) return '';
  // naive DFS
  const parts: string[] = [];
  function walk(node: JSONContent) {
    if (!node) return;
    if (node.type === 'text' && node.text) parts.push(node.text);
    if (Array.isArray(node.content)) for (const c of node.content) walk(c);
  }
  walk(pm);
  return parts.join(' ');
}
