'use node';

// Node-only internals for site publishing and pointer flips
import { internalAction } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { api } from './_generated/api';

import { put } from '@vercel/blob';
import { createHash } from 'node:crypto';
import { serialize as serializeContent } from '@docufy/content-kit/renderer';
import type { JSONContent } from '@tiptap/core';

// -------------------- Types --------------------

interface DocumentTreeNode {
  _id: Id<'documents'>;
  type: 'page' | 'group';
  title: string;
  slug: string;
  iconName?: string;
  children?: DocumentTreeNode[];
}

interface SpaceWithTree {
  space: {
    _id: Id<'spaces'>;
    name: string;
    slug: string;
    iconName?: string;
  };
  tree: DocumentTreeNode[];
}

// Manifest v2 (content-addressed bundles)
type PageBundleRef = {
  hash: string; // sha256 hex
  key: string; // "sites/<projectId>/blobs/<hash>.json"
  url: string; // fully-qualified URL with baseUrl prefix for convenience
  size: number; // bytes
};
interface BuildManifestV2 {
  projectId: Id<'projects'>;
  siteId: Id<'sites'>;
  buildId: string;
  publishedAt: number;
  counts: { pages: number; newBlobs: number; reusedBlobs: number };
  spacesPublished: Array<{ _id: Id<'spaces'>; slug: string; name: string }>;
  contentVersion: 'pm-bundle-v2';
  // docId -> bundle ref
  pages: Record<string, PageBundleRef>;
}

// -------------------- Helpers (Node runtime) --------------------

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function byteLengthUtf8(s: string): number {
  return Buffer.byteLength(s, 'utf8');
}

// Small utility to approximate plain text from a PM doc
function extractPlainTextFromPm(pm: JSONContent | null): string {
  if (!pm) return '';
  const parts: string[] = [];
  function walk(node: JSONContent) {
    if (!node) return;
    if (node.type === 'text' && node.text) parts.push(node.text);
    if (Array.isArray(node.content)) for (const c of node.content) walk(c as JSONContent);
  }
  walk(pm);
  return parts.join(' ');
}

// Only writes to the immutable versioned build folder
async function writeVersioned({
  projectId,
  buildId,
  key,
  content,
  contentType,
}: {
  projectId: Id<'projects'>;
  buildId: string;
  key: string; // e.g. 'tree.json' or 'manifest.json'
  content: string;
  contentType: string;
}) {
  const versionedKey = `sites/${projectId}/${buildId}/${key}`;
  await put(versionedKey, content, {
    access: 'public',
    contentType,
    cacheControlMaxAge: 31536000, // immutable
    addRandomSuffix: false,
    allowOverwrite: false,
  });
}

// For the small mutable pointer that the consumer hits first
async function writeLatestPointer({
  projectId,
  payload,
}: {
  projectId: Id<'projects'>;
  payload: { buildId: string; treeUrl: string; manifestUrl: string };
}) {
  await put(`sites/${projectId}/latest.json`, JSON.stringify(payload), {
    access: 'public',
    contentType: 'application/json',
    cacheControlMaxAge: 0, // revalidate on each view
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

// -------------------- Actions (internal) --------------------

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

    const trees: SpaceWithTree[] = [];
    for (const s of selected) {
      const tree = await ctx.runQuery(api.documents.getTreeForSpace, { spaceId: s._id });
      trees.push({ space: { _id: s._id, name: s.name, slug: s.slug, iconName: s.iconName }, tree });
    }

    // 2) Flatten pages
    const pages: Array<{
      id: Id<'documents'>;
      slug: string;
      pmsDocKey?: string;
      title: string;
      path: string[];
      iconName?: string;
    }> = [];

    function walk(node: DocumentTreeNode, parents: DocumentTreeNode[] = []) {
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
      for (const child of node.children ?? []) walk(child, parents.concat(node));
    }
    for (const { tree } of trees) for (const n of tree) walk(n, []);

    await ctx.runMutation(api.sites._updateProgress, {
      siteId,
      buildId,
      deltaItems: 0,
      deltaPages: 0,
      deltaBytes: 0,
      itemsTotal: pages.length,
    });

    // 3) Write versioned tree.json (renderer boots from this)
    const treePayload = {
      projectId: site.projectId,
      buildId,
      publishedAt: Date.now(),
      spaces: trees.map(({ space, tree }) => ({ space, tree })),
    };
    await writeVersioned({
      projectId: site.projectId,
      buildId,
      key: 'tree.json',
      content: JSON.stringify(treePayload),
      contentType: 'application/json',
    });

    // 4) For each page: get snapshot, build bundle, hash, and store/reuse
    let newBlobs = 0;
    let reusedBlobs = 0;
    const pageRefs: Record<string, PageBundleRef> = {};

    for (const p of pages) {
      const docKey = p.pmsDocKey ?? `space/${String(site.projectId) /* backfill ok */}/doc/${p.id}`;

      // latestVersion returns number | null
      const latest = await ctx.runQuery(api.editor.latestVersion, { id: docKey });
      let pmDoc: JSONContent | null = null;
      if (latest !== null) {
        const snap = await ctx.runQuery(api.editor.getSnapshot, { id: docKey, version: latest });
        if ('content' in snap && snap.content) {
          pmDoc = JSON.parse(snap.content) as JSONContent;
        }
      }

      const plain = extractPlainTextFromPm(pmDoc);
      const { html, toc } = serializeContent(pmDoc ?? {});

      const bundleObj = {
        id: String(p.id),
        slug: p.slug,
        title: p.title,
        path: p.path,
        iconName: p.iconName,
        rendered: { html, toc },
        plain,
        source: pmDoc ?? {},
        // room for metadata additions later
      };
      const bundle = JSON.stringify(bundleObj);
      const hash = sha256Hex(bundle);
      const key = `sites/${site.projectId}/blobs/${hash}.json`;
      const size = byteLengthUtf8(bundle);

      const existing = await ctx.runQuery(api.sites._getBlobByHash, {
        projectId: site.projectId as Id<'projects'>,
        hash,
      });

      if (!existing) {
        // Store the content-addressed blob
        await put(key, bundle, {
          access: 'public',
          contentType: 'application/json',
          cacheControlMaxAge: 31536000,
          addRandomSuffix: false,
          allowOverwrite: false, // content-addressed: never overwrite
        });
        await ctx.runMutation(api.sites._recordBlobIfMissing, {
          projectId: site.projectId,
          hash,
          key,
          size,
        });
        newBlobs += 1;

        await ctx.runMutation(api.sites._updateProgress, {
          siteId,
          buildId,
          deltaItems: 1,
          deltaPages: 1,
          deltaBytes: size,
        });
      } else {
        reusedBlobs += 1;
        // Still advance items/pages so the UI shows page progress
        await ctx.runMutation(api.sites._updateProgress, {
          siteId,
          buildId,
          deltaItems: 1,
          deltaPages: 1,
          deltaBytes: 0,
        });
      }

      pageRefs[String(p.id)] = {
        hash,
        key,
        url: `${site.baseUrl}/${key}`,
        size,
      };
    }

    // 5) manifest.json (points to content-addressed bundles)
    const manifest: BuildManifestV2 = {
      projectId: site.projectId,
      siteId,
      buildId,
      publishedAt: Date.now(),
      counts: { pages: pages.length, newBlobs, reusedBlobs },
      spacesPublished: selected.map((s) => ({ _id: s._id, slug: s.slug, name: s.name })),
      contentVersion: 'pm-bundle-v2',
      pages: pageRefs,
    };

    await writeVersioned({
      projectId: site.projectId,
      buildId,
      key: 'manifest.json',
      content: JSON.stringify(manifest),
      contentType: 'application/json',
    });

    // 6) Update "latest.json" pointer (no-cache), pointing to **versioned** assets
    await writeLatestPointer({
      projectId: site.projectId,
      payload: {
        buildId,
        treeUrl: `${site.baseUrl}/sites/${site.projectId}/${buildId}/tree.json`,
        manifestUrl: `${site.baseUrl}/sites/${site.projectId}/${buildId}/manifest.json`,
      },
    });
  },
});

// Minimal revert pointer operation (validation + pointer write)
export const _revertPointer = internalAction({
  args: {
    projectId: v.id('projects'),
    baseUrl: v.string(),
    buildId: v.string(), // NEW: materialize under this build id
    targetBuildId: v.string(),
  },
  handler: async (ctx, { projectId, baseUrl, buildId, targetBuildId }) => {
    // 1) Load target build's manifest and tree
    const manifestRes = await fetch(`${baseUrl}/sites/${projectId}/${targetBuildId}/manifest.json`);
    if (!manifestRes.ok) throw new Error(`Missing manifest.json for build ${targetBuildId}`);
    const treeRes = await fetch(`${baseUrl}/sites/${projectId}/${targetBuildId}/tree.json`);
    if (!treeRes.ok) throw new Error(`Missing tree.json for build ${targetBuildId}`);

    const sourceManifest = await manifestRes.json();
    const sourceTree = await treeRes.json();

    // Optional: keep blobs fresh by touching hashes referenced in the manifest
    try {
      const hashes: string[] = Object.values(sourceManifest.pages ?? {})
        .map((p) => {
          if (typeof p === 'object' && p !== null && 'hash' in p) return p.hash;
          return undefined;
        })
        .filter((h) => h !== undefined) as string[];
      if (hashes.length > 0) {
        await ctx.runMutation(api.sites._touchBlobs, { projectId, hashes });
      }
    } catch {
      // best-effort; do not block revert
    }

    // 2) Materialize under the NEW buildId with updated timestamps and ids
    const now = Date.now();
    const aliasedManifest = {
      ...sourceManifest,
      buildId,
      publishedAt: now,
      aliasedFromBuildId: targetBuildId, // non-breaking optional field for UI context
    };
    const aliasedTree = {
      ...sourceTree,
      buildId,
      publishedAt: now,
    };

    await writeVersioned({
      projectId,
      buildId,
      key: 'tree.json',
      content: JSON.stringify(aliasedTree),
      contentType: 'application/json',
    });
    await writeVersioned({
      projectId,
      buildId,
      key: 'manifest.json',
      content: JSON.stringify(aliasedManifest),
      contentType: 'application/json',
    });

    // 3) Update latest.json pointer to the NEW buildId for consistency
    await writeLatestPointer({
      projectId,
      payload: {
        buildId,
        treeUrl: `${baseUrl}/sites/${projectId}/${buildId}/tree.json`,
        manifestUrl: `${baseUrl}/sites/${projectId}/${buildId}/manifest.json`,
      },
    });
  },
});
