'use node';

// Node-only internals for site publishing and pointer flips
import { internalAction } from './_generated/server';
import { v } from 'convex/values';
import type { Id, Doc } from './_generated/dataModel';
import { api } from './_generated/api';

import { put } from '@vercel/blob';
import { createHash } from 'node:crypto';
import { serialize as serializeContent } from '@docufy/content-kit/renderer';
import type { JSONContent } from '@tiptap/core';

// -------------------- Types --------------------

// Tree/doc shapes coming from getTreeForSpace
interface DocumentTreeNode {
  _id: Id<'documents'>;
  type: 'page' | 'group';
  title: string;
  slug: string;
  iconName?: string;
  updatedAt?: number; // added in documents.getTreeForSpace
  children?: DocumentTreeNode[];
  pmsDocKey?: string;
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

// Page bundle ref (content-addressed JSON blob)
type PageBundleRef = {
  hash: string; // sha256 hex
  key: string; // "sites/<projectId>/blobs/<hash>.json"
  url: string; // fully-qualified URL with baseUrl prefix for convenience
  size: number; // bytes
};

// Manifest v3 (route-indexed with prefetch hints)
type NavSpace = {
  slug: string;
  name: string;
  style: 'dropdown' | 'tab';
  order: number;
  iconName?: string;
  entry?: string; // first route for this space
};

type PageIndexEntry = {
  title: string;
  space: string; // space slug
  iconName?: string;
  blob: string; // relative blob key
  hash: string;
  size: number;
  neighbors: string[]; // routes
  lastModified: number;
};

interface BuildManifestV3 {
  version: 3;
  contentVersion: 'pm-bundle-v2';
  buildId: string;
  publishedAt: number;
  site: {
    projectId: Id<'projects'>;
    name?: string | null;
    logoUrl?: string | null;
    layout: 'sidebar-dropdown' | 'sidebar-tabs';
    baseUrl: string;
  };
  routing: {
    basePath: string;
    defaultSpace: string;
  };
  nav: { spaces: NavSpace[] };
  counts: { pages: number; newBlobs: number; reusedBlobs: number };
  pages: Record<string, PageIndexEntry>; // route -> index entry
}

// Tree v2 for UI
type UiTreeItem = {
  kind: 'group' | 'page';
  title: string;
  iconName?: string;
  slug: string;
  route: string;
  children?: UiTreeItem[];
};

type UiTreeSpace = {
  space: { slug: string; name: string; iconName?: string };
  items: UiTreeItem[];
};

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

// For domain aliases: one small mutable pointer per hostname
async function writeDomainAliases({
  hosts,
  payload,
}: {
  hosts: Array<string | undefined | null>;
  payload: { buildId: string; treeUrl: string; manifestUrl: string; basePath?: string };
}) {
  const putOpts = {
    access: 'public' as const,
    contentType: 'application/json',
    cacheControlMaxAge: 0,
    addRandomSuffix: false,
    allowOverwrite: true,
  };
  for (const h of hosts) {
    if (!h) continue;
    const host = String(h).toLowerCase().split(':')[0];
    if (!host) continue;
    await put(`domains/${host}/latest.json`, JSON.stringify(payload), putOpts);
  }
}

// -------------------- Actions (internal) --------------------

// Expose a small internal helper so other actions can mirror the pointer
export const _mirrorPointerToDomains = internalAction({
  args: { siteId: v.id('sites'), hosts: v.array(v.string()) },
  handler: async (ctx, { siteId, hosts }) => {
    const site = await ctx.runQuery(api.sites.getSite, { siteId });
    if (!site) throw new Error('Site not found');
    const buildId = site.lastBuildId;
    if (!buildId) return; // nothing published yet

    const payload = {
      buildId,
      treeUrl: `${site.baseUrl}/sites/${site.projectId}/${buildId}/tree.json`,
      manifestUrl: `${site.baseUrl}/sites/${site.projectId}/${buildId}/manifest.json`,
      basePath: '',
    } as const;

    await writeDomainAliases({ hosts, payload });
  },
});

export const _doPublish = internalAction({
  args: { siteId: v.id('sites'), buildId: v.string() },
  handler: async (ctx, { siteId, buildId }) => {
    const site = await ctx.runQuery(api.sites.getSite, { siteId });
    if (!site) throw new Error('Site not found');

    // Load all spaces to preserve the selected order
    const allSpaces = (await ctx.runQuery(api.spaces.list, {
      projectId: site.projectId,
    })) as Doc<'spaces'>[];
    const selected: Doc<'spaces'>[] = site.selectedSpaceIds
      .map((id: Id<'spaces'>) => allSpaces.find((s: Doc<'spaces'>) => String(s._id) === String(id)))
      .filter((s): s is Doc<'spaces'> => !!s);

    // Materialize trees for selected spaces
    const trees: SpaceWithTree[] = [];
    for (const s of selected) {
      const tree = await ctx.runQuery(api.documents.getTreeForSpace, { spaceId: s._id });
      trees.push({ space: { _id: s._id, name: s.name, slug: s.slug, iconName: s.iconName }, tree });
    }

    // Flatten pages with routes and space context
    type FlatPage = {
      id: Id<'documents'>;
      title: string;
      slug: string;
      path: string[]; // within space
      iconName?: string;
      spaceId: Id<'spaces'>;
      spaceSlug: string;
      updatedAt?: number;
      pmsDocKey?: string;
    };

    const flatPages: FlatPage[] = [];
    const routesBySpace = new Map<string, string[]>(); // slug -> ordered list of routes
    const routeByDocId = new Map<string, string>();

    function routeFor(spaceSlug: string, segments: string[]) {
      return `/${spaceSlug}/${segments.join('/')}`;
    }

    for (const { space, tree } of trees) {
      function walk(n: DocumentTreeNode, parents: DocumentTreeNode[] = []) {
        const path = parents.map((p) => p.slug).concat(n.slug);
        if (n.type === 'page') {
          const route = routeFor(space.slug, path);
          flatPages.push({
            id: n._id,
            title: n.title,
            slug: n.slug,
            path,
            iconName: n.iconName,
            spaceId: space._id,
            spaceSlug: space.slug,
            updatedAt: n.updatedAt,
            pmsDocKey: n.pmsDocKey,
          });
          routeByDocId.set(String(n._id), route);
          const arr = routesBySpace.get(space.slug) ?? [];
          arr.push(route);
          routesBySpace.set(space.slug, arr);
        }
        for (const c of n.children ?? []) walk(c, parents.concat(n));
      }
      for (const n of tree) walk(n, []);
    }

    await ctx.runMutation(api.sites._updateProgress, {
      siteId,
      buildId,
      deltaItems: 0,
      deltaPages: 0,
      deltaBytes: 0,
      itemsTotal: flatPages.length,
    });

    // Build UI-focused tree v2 with routes
    const uiTreeSpaces: UiTreeSpace[] = trees.map(({ space, tree }) => {
      function asUi(node: DocumentTreeNode, parents: DocumentTreeNode[] = []): UiTreeItem {
        const route = routeFor(space.slug, parents.map((p) => p.slug).concat(node.slug));
        const base = {
          kind: node.type,
          title: node.title,
          iconName: node.iconName,
          slug: node.slug,
          route,
        } as UiTreeItem;
        if (node.children?.length) {
          return { ...base, children: node.children.map((c) => asUi(c, parents.concat(node))) };
        }
        return base;
      }
      return {
        space: { slug: space.slug, name: space.name, iconName: space.iconName },
        items: tree.map((n) => asUi(n, [])),
      };
    });

    const navSpaces: NavSpace[] = selected.map((s: Doc<'spaces'>, i: number) => ({
      slug: s.slug,
      name: s.name,
      style: 'dropdown',
      order: i + 1,
      iconName: s.iconName,
      entry: (routesBySpace.get(s.slug) ?? [])[0],
    }));

    const treePayload = {
      version: 2,
      projectId: site.projectId,
      buildId,
      publishedAt: Date.now(),
      nav: { spaces: navSpaces.map(({ style: _style, ...rest }) => rest) },
      spaces: uiTreeSpaces,
    };

    await writeVersioned({
      projectId: site.projectId,
      buildId,
      key: 'tree.json',
      content: JSON.stringify(treePayload),
      contentType: 'application/json',
    });

    // Build page bundles and store/reuse content-addressed blobs
    let newBlobs = 0;
    let reusedBlobs = 0;
    const pageRefs: Record<string, PageBundleRef> = {};

    for (const p of flatPages) {
      const docKey = p.pmsDocKey ?? `space/${String(site.projectId)}/doc/${p.id}`;
      const latest = await ctx.runQuery(api.editor.latestVersion, { id: docKey });

      let pmDoc: JSONContent | null = null;
      if (latest !== null) {
        const snap = await ctx.runQuery(api.editor.getSnapshot, { id: docKey, version: latest });
        if ('content' in snap && snap.content) {
          pmDoc = JSON.parse(snap.content) as JSONContent;
        }
      }

      const plain = extractPlainTextFromPm(pmDoc);
      const { html, toc } = await serializeContent(pmDoc ?? {});

      const bundleObj = {
        id: String(p.id),
        slug: p.slug,
        title: p.title,
        path: p.path,
        iconName: p.iconName,
        rendered: { html, toc },
        plain,
        source: pmDoc ?? {},
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
        await put(key, bundle, {
          access: 'public',
          contentType: 'application/json',
          cacheControlMaxAge: 31536000,
          addRandomSuffix: false,
          allowOverwrite: false,
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

    // Build route-indexed page entries with neighbor prefetch hints
    const pagesIndex: BuildManifestV3['pages'] = {};
    const now = Date.now();
    for (const p of flatPages) {
      const ref = pageRefs[String(p.id)]!;
      const route = routeByDocId.get(String(p.id))!;
      pagesIndex[route] = {
        title: p.title,
        space: p.spaceSlug,
        iconName: p.iconName,
        blob: ref.key,
        hash: ref.hash,
        size: ref.size,
        neighbors: [],
        lastModified: p.updatedAt ?? now,
      };
    }

    // Prefetch neighbors: next 1-2 pages within each space
    for (const [_spaceSlug, routes] of routesBySpace.entries()) {
      for (let i = 0; i < routes.length; i++) {
        const here: string = routes[i]!;
        const n: string[] = [];
        const r1 = routes[i + 1];
        if (r1) n.push(r1);
        const r2 = routes[i + 2];
        if (r2) n.push(r2);
        const entry = pagesIndex[here];
        if (entry) entry.neighbors = n;
      }
    }

    // Final manifest v3
    const manifest: BuildManifestV3 = {
      version: 3,
      contentVersion: 'pm-bundle-v2',
      buildId,
      publishedAt: Date.now(),
      site: {
        projectId: site.projectId,
        name: null,
        logoUrl: null,
        layout: 'sidebar-dropdown',
        baseUrl: site.baseUrl as string,
      },
      routing: {
        basePath: '/',
        defaultSpace: navSpaces[0]?.slug ?? selected[0]?.slug ?? 'docs',
      },
      nav: { spaces: navSpaces },
      counts: { pages: flatPages.length, newBlobs, reusedBlobs },
      pages: pagesIndex,
    };

    await writeVersioned({
      projectId: site.projectId,
      buildId,
      key: 'manifest.json',
      content: JSON.stringify(manifest),
      contentType: 'application/json',
    });

    // Update latest pointer to new immutable assets
    await writeLatestPointer({
      projectId: site.projectId,
      payload: {
        buildId,
        treeUrl: `${site.baseUrl}/sites/${site.projectId}/${buildId}/tree.json`,
        manifestUrl: `${site.baseUrl}/sites/${site.projectId}/${buildId}/manifest.json`,
      },
    });

    // Mirror latest pointer to domain aliases
    await writeDomainAliases({
      hosts: [site.primaryHost, ...(site.customDomains ?? [])],
      payload: {
        buildId,
        treeUrl: `${site.baseUrl}/sites/${site.projectId}/${buildId}/tree.json`,
        manifestUrl: `${site.baseUrl}/sites/${site.projectId}/${buildId}/manifest.json`,
        basePath: '',
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

    // Mirror pointer to domain aliases for this project (single site per project)
    try {
      const sites = await ctx.runQuery(api.sites.listByProject, { projectId });
      const site = sites[0];
      if (site) {
        await writeDomainAliases({
          hosts: [site.primaryHost, ...(site.customDomains ?? [])],
          payload: {
            buildId,
            treeUrl: `${baseUrl}/sites/${projectId}/${buildId}/tree.json`,
            manifestUrl: `${baseUrl}/sites/${projectId}/${buildId}/manifest.json`,
            basePath: '',
          },
        });
      }
    } catch {
      // best-effort; do not block revert
    }
  },
});
