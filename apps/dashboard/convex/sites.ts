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

// JSON representations (for parsed data from tree.json)
interface DocumentTreeNodeJson {
  _id: string;
  type: 'page' | 'group';
  title: string;
  slug: string;
  iconName?: string;
  children?: DocumentTreeNodeJson[];
}

interface SpaceWithTreeJson {
  space: {
    _id: string;
    name: string;
    slug: string;
    iconName?: string;
  };
  tree: DocumentTreeNodeJson[];
}

interface TreeJsonStructure {
  projectId: string;
  buildId: string;
  publishedAt: number;
  spaces: SpaceWithTreeJson[];
}

// Helper to write artifacts to both the versioned build folder and the hot latest/ folder
async function writeBoth({
  projectId,
  buildId,
  key,
  content,
  contentType,
}: {
  projectId: Id<'projects'>;
  buildId: string;
  key: string; // e.g. 'tree.json' or 'docs/<id>.html'
  content: string;
  contentType: string;
}) {
  const versionedKey = `sites/${projectId}/${buildId}/${key}`;
  const latestKey = `sites/${projectId}/latest/${key}`;
  // Long-lived cache for immutable versioned files
  await put(versionedKey, content, {
    access: 'public',
    contentType,
    cacheControlMaxAge: 31536000,
    addRandomSuffix: false,
    // versioned path is immutable across builds; safe default is to not overwrite
  });
  // Hot path for latest/ should be effectively uncached and overwritable
  await put(latestKey, content, {
    access: 'public',
    contentType,
    cacheControlMaxAge: 0,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

// Helper to write only to latest/ (no versioned copy)
async function writeLatest({
  projectId,
  key,
  content,
  contentType,
}: {
  projectId: Id<'projects'>;
  key: string;
  content: string;
  contentType: string;
}) {
  const latestKey = `sites/${projectId}/latest/${key}`;
  await put(latestKey, content, {
    access: 'public',
    contentType,
    cacheControlMaxAge: 0,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

// Helper to write only to the versioned build path
async function writeVersioned({
  projectId,
  buildId,
  key,
  content,
  contentType,
}: {
  projectId: Id<'projects'>;
  buildId: string;
  key: string;
  content: string;
  contentType: string;
}) {
  const versionedKey = `sites/${projectId}/${buildId}/${key}`;
  await put(versionedKey, content, {
    access: 'public',
    contentType,
    cacheControlMaxAge: 31536000,
    addRandomSuffix: false,
  });
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

    // Actor for history
    const me = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!me) throw appError('UNAUTHORIZED');

    const buildId = Date.now().toString(36);
    // snapshot the selection at enqueue
    await ctx.runMutation(api.sites._startBuild, {
      siteId,
      buildId,
      operation: 'publish',
      actorUserId: me._id,
      selectedSpaceIdsSnapshot: site.selectedSpaceIds,
      targetBuildId: undefined,
    });

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
  args: {
    siteId: v.id('sites'),
    buildId: v.string(),
    operation: v.union(v.literal('publish'), v.literal('revert')),
    actorUserId: v.id('users'),
    selectedSpaceIdsSnapshot: v.array(v.id('spaces')),
    targetBuildId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { siteId, buildId, operation, actorUserId, selectedSpaceIdsSnapshot, targetBuildId },
  ) => {
    const id = await ctx.db.insert('siteBuilds', {
      siteId,
      buildId,
      status: 'running',
      startedAt: Date.now(),
      itemsTotal: 0,
      itemsDone: 0,
      pagesWritten: 0,
      bytesWritten: 0,
      operation,
      actorUserId,
      selectedSpaceIdsSnapshot,
      targetBuildId,
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
    // Update the intended build explicitly by buildId to avoid races
    const build = await ctx.db
      .query('siteBuilds')
      .filter((q) => q.eq(q.field('buildId'), args.buildId))
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
    await writeBoth({
      projectId: site.projectId,
      buildId,
      key: 'tree.json',
      content: JSON.stringify(treePayload),
      contentType: 'application/json',
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

      await writeBoth({
        projectId: site.projectId,
        buildId,
        key: `docs/${p.id}.pm.json`,
        content: pmJson,
        contentType: 'application/json',
      });

      // Plain text for search bootstrap (quick heuristic)
      const plain = extractPlainTextFromPm(pmDoc);
      await writeBoth({
        projectId: site.projectId,
        buildId,
        key: `docs/${p.id}.txt`,
        content: plain,
        contentType: 'text/plain',
      });

      const { html, toc } = serializeContent(pmDoc ?? {});
      await writeBoth({
        projectId: site.projectId,
        buildId,
        key: `docs/${p.id}.html`,
        content: html,
        contentType: 'text/html',
      });

      await writeBoth({
        projectId: site.projectId,
        buildId,
        key: `docs/${p.id}.toc.json`,
        content: JSON.stringify(toc),
        contentType: 'application/json',
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
    await writeBoth({
      projectId: site.projectId,
      buildId,
      key: 'manifest.json',
      content: JSON.stringify(manifest),
      contentType: 'application/json',
    });

    // 6) Update "latest.json" pointer (no-cache)
    await put(
      `sites/${site.projectId}/latest.json`,
      JSON.stringify({
        buildId,
        treeUrl: `${site.baseUrl}/sites/${site.projectId}/latest/tree.json`,
        manifestUrl: `${site.baseUrl}/sites/${site.projectId}/latest/manifest.json`,
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

// Revert: copy a previous build's artifacts into latest/ and update pointer
export const revertToBuild = action({
  args: { siteId: v.id('sites'), targetBuildId: v.string() },
  handler: async (ctx, { siteId, targetBuildId }) => {
    const site = await ctx.runQuery(api.sites.getSite, { siteId });
    if (!site) throw appError('SITE_NOT_FOUND');
    await ctx.runQuery(api.sites.assertProjectAccess, { siteId });

    const me = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!me) throw appError('UNAUTHORIZED');

    // Treat revert as a fresh build id for clearer history
    const buildId = Date.now().toString(36);
    await ctx.runMutation(api.sites._startBuild, {
      siteId,
      buildId,
      operation: 'revert',
      actorUserId: me._id,
      selectedSpaceIdsSnapshot: site.selectedSpaceIds,
      targetBuildId: targetBuildId,
    });

    try {
      const projectId = site.projectId as Id<'projects'>;
      const baseUrl = site.baseUrl as string;
      const base = `${baseUrl}/sites/${projectId}/${targetBuildId}`;

      const treeRes = await fetch(`${base}/tree.json`);
      if (!treeRes.ok) throw new Error(`Missing tree.json for build ${targetBuildId}`);
      const treeText = await treeRes.text();

      const manifestRes = await fetch(`${base}/manifest.json`);
      if (!manifestRes.ok) throw new Error(`Missing manifest.json for build ${targetBuildId}`);
      const manifestText = await manifestRes.text();

      // Write tree & manifest to versioned (new buildId). We'll write latest at the end for atomicity.
      await writeVersioned({
        projectId,
        buildId,
        key: 'tree.json',
        content: treeText,
        contentType: 'application/json',
      });
      await writeVersioned({
        projectId,
        buildId,
        key: 'manifest.json',
        content: manifestText,
        contentType: 'application/json',
      });

      // Parse list of doc IDs from the tree to copy page artifacts
      const tree: TreeJsonStructure = JSON.parse(treeText);
      const docIds: string[] = [];

      function walk(node: DocumentTreeNodeJson) {
        if (node?.type === 'page' && node._id) docIds.push(String(node._id));
        for (const c of node?.children ?? []) walk(c);
      }

      for (const root of tree.spaces?.flatMap((s) => s.tree) ?? []) walk(root);

      // Initialize progress totals for correct UI (X of Y pages)
      await ctx.runMutation(api.sites._updateProgress, {
        siteId,
        buildId,
        deltaItems: 0,
        deltaPages: 0,
        deltaBytes: 0,
        itemsTotal: docIds.length,
      });
      // Linear (sequential) copy to avoid concurrent mutation conflicts
      for (const id of docIds) {
        const [pm, txt, html, toc] = await Promise.all([
          fetch(`${base}/docs/${id}.pm.json`).then((r) => r.text()),
          fetch(`${base}/docs/${id}.txt`).then((r) => r.text()),
          fetch(`${base}/docs/${id}.html`).then((r) => r.text()),
          fetch(`${base}/docs/${id}.toc.json`).then((r) => r.text()),
        ]);
        await Promise.all([
          writeBoth({
            projectId,
            buildId,
            key: `docs/${id}.pm.json`,
            content: pm,
            contentType: 'application/json',
          }),
          writeBoth({
            projectId,
            buildId,
            key: `docs/${id}.txt`,
            content: txt,
            contentType: 'text/plain',
          }),
          writeBoth({
            projectId,
            buildId,
            key: `docs/${id}.html`,
            content: html,
            contentType: 'text/html',
          }),
          writeBoth({
            projectId,
            buildId,
            key: `docs/${id}.toc.json`,
            content: toc,
            contentType: 'application/json',
          }),
        ]);
        await ctx.runMutation(api.sites._updateProgress, {
          siteId,
          buildId,
          deltaItems: 1,
          deltaPages: 1,
          deltaBytes: pm.length + txt.length + html.length + toc.length,
        });
      }

      // Now that all docs are present, write latest tree & manifest, then update lightweight pointer
      await writeLatest({
        projectId,
        key: 'tree.json',
        content: treeText,
        contentType: 'application/json',
      });
      await writeLatest({
        projectId,
        key: 'manifest.json',
        content: manifestText,
        contentType: 'application/json',
      });
      // Update latest.json pointer to use latest/
      await put(
        `sites/${projectId}/latest.json`,
        JSON.stringify({
          buildId,
          treeUrl: `${baseUrl}/sites/${projectId}/latest/tree.json`,
          manifestUrl: `${baseUrl}/sites/${projectId}/latest/manifest.json`,
        }),
        {
          access: 'public',
          contentType: 'application/json',
          cacheControlMaxAge: 0,
          addRandomSuffix: false,
          allowOverwrite: true,
        },
      );

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
