import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { appError } from './_utils/errors';
import { Id } from './_generated/dataModel';
import { GenericMutationCtx } from 'convex/server';
import { DataModel } from './_generated/dataModel';

/* ---------- Slug helpers ---------- */
function slugify(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

function randomSlug(len = 10) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

async function ensureUniqueSlug(
  ctx: GenericMutationCtx<DataModel>,
  spaceId: Id<'spaces'>,
  parentId: Id<'documents'> | undefined,
  base: string,
) {
  let attempt = base;
  for (let i = 0; i < 5; i++) {
    const existing = await ctx.db
      .query('documents')
      .withIndex('by_space_parent_slug', (q) =>
        q
          .eq('spaceId', spaceId)
          .eq('parentId', parentId ?? undefined)
          .eq('slug', attempt),
      )
      .first();
    if (!existing) return attempt;
    attempt = randomSlug();
  }
  return `${base}-${Date.now().toString(36)}`;
}

/* ---------- Lexicographic rank helpers (fractional indexing) ---------- */
/**
 * We generate totally ordered, dense keys over the alphabet below.
 * You can always generate a key strictly between two keys, and keys
 * can grow in length when needed to maintain density.
 */
const RANK_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const MIN_CHAR = RANK_ALPHABET[0];
const MAX_CHAR = RANK_ALPHABET[RANK_ALPHABET.length - 1];

function rankBetween(a?: string, b?: string): string {
  if (a !== undefined && b !== undefined && a >= b) {
    throw appError('INVALID_RANK_RANGE', 'Left bound must be < right bound');
  }
  let i = 0;
  let prefix = '';
  // At each position, take characters of a and b, defaulting to MIN for a and MAX for b.
  // If there is "space" between them, pick the mid character. Otherwise, carry and go deeper.
  // This always terminates with some finite-length key.
  // Example: between 'a' and 'b' -> 'aV' (given our alphabet).
  while (true) {
    const ca = (a && a[i]) ?? MIN_CHAR;
    const cb = (b && b[i]) ?? MAX_CHAR;

    if (ca === cb) {
      prefix += ca;
      i++;
      continue;
    }

    if (!ca || !cb) {
      throw appError('INVALID_RANK_RANGE', 'Left bound must be < right bound');
    }

    const ia = RANK_ALPHABET.indexOf(ca);
    const ib = RANK_ALPHABET.indexOf(cb);

    if (ib - ia > 1) {
      const mid = Math.floor((ia + ib) / 2);
      return prefix + RANK_ALPHABET[mid];
    }

    // No room at this digit. Fix it to ca and go deeper.
    prefix += ca;
    i++;
  }
}

const rankAfter = (a?: string) => rankBetween(a, undefined);
const rankBefore = (b?: string) => rankBetween(undefined, b);

/* ---------- Mutations & Queries ---------- */

// Create a new document
export const createDocument = mutation({
  args: {
    spaceId: v.id('spaces'),
    title: v.string(),
    slug: v.optional(v.string()),
    type: v.union(v.literal('page'), v.literal('group')),
    parentId: v.optional(v.id('documents')),
    isHidden: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw appError('UNAUTHORIZED', 'Unauthorized');

    const user = await ctx.db
      .query('users')
      .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', identity.subject))
      .first();
    if (!user) throw appError('USER_NOT_FOUND', 'User not found');

    const space = await ctx.db.get(args.spaceId);
    if (!space) throw appError('SPACE_NOT_FOUND', 'Space not found');

    // Membership & role
    const membership = await ctx.db
      .query('projectMembers')
      .withIndex('by_project_and_user', (q) =>
        q.eq('projectId', space.projectId).eq('userId', user._id),
      )
      .first();
    if (!membership) throw appError('ACCESS_DENIED', 'Access denied');
    const allowedRoles = ['owner', 'admin', 'editor'];
    if (!allowedRoles.includes(membership.role))
      throw appError('WRITE_ACCESS_DENIED', 'Insufficient permissions');

    // Type constraints
    if (args.type === 'group' && args.parentId) {
      throw appError('GROUP_MUST_BE_TOP_LEVEL', 'Groups can only exist at top level');
    }
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (!parent) throw appError('PARENT_NOT_FOUND', 'Parent not found');
      if (args.type === 'page' && !['group', 'page'].includes(parent.type)) {
        throw appError('INVALID_PARENT', 'Invalid parent for page');
      }
      if (parent.archivedAt) throw appError('PARENT_ARCHIVED', 'Cannot add under archived parent');
    }

    const base = args.slug ? slugify(args.slug) : randomSlug();
    const slug = await ensureUniqueSlug(ctx, args.spaceId, args.parentId ?? undefined, base);

    // Determine rank: append to end under target parent
    const last = await ctx.db
      .query('documents')
      .withIndex('by_space_parent_rank', (q) =>
        q.eq('spaceId', args.spaceId).eq('parentId', args.parentId ?? undefined),
      )
      .order('desc')
      .first();

    const rank = last ? rankAfter(last.rank) : rankBetween(undefined, undefined);

    const now = Date.now();
    const docId = await ctx.db.insert('documents', {
      spaceId: args.spaceId,
      type: args.type,
      title: args.title,
      slug,
      parentId: args.parentId,
      rank,
      isHidden: args.isHidden ?? false,
      createdAt: now,
      updatedAt: now,
    });

    if (args.type === 'page') {
      const pmsDocKey = `space/${args.spaceId}/doc/${docId}`;
      await ctx.db.patch(docId, { pmsDocKey });
    }

    return await ctx.db.get(docId);
  },
});

// Get a document by ID
export const getDocument = query({
  args: { documentId: v.id('documents') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw appError('UNAUTHORIZED', 'Unauthorized');

    const document = await ctx.db.get(args.documentId);
    if (!document) return null;

    const space = await ctx.db.get(document.spaceId);
    if (!space) throw appError('SPACE_NOT_FOUND', 'Space not found');

    const user = await ctx.db
      .query('users')
      .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', identity.subject))
      .first();

    if (!user) throw appError('USER_NOT_FOUND', 'User not found');

    // Check membership
    const membership = await ctx.db
      .query('projectMembers')
      .withIndex('by_project_and_user', (q) =>
        q.eq('projectId', space.projectId).eq('userId', user._id),
      )
      .first();

    if (!membership) throw appError('ACCESS_DENIED', 'Access denied');

    const editableRoles = ['owner', 'admin', 'editor'];
    const editable = editableRoles.includes(membership.role);

    return { document, editable };
  },
});

// Get documents in a space (siblings ordered by rank)
export const getDocumentsInSpace = query({
  args: { spaceId: v.id('spaces'), parentId: v.optional(v.id('documents')) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw appError('UNAUTHORIZED', 'Unauthorized');

    const space = await ctx.db.get(args.spaceId);
    if (!space) throw appError('SPACE_NOT_FOUND', 'Space not found');

    const user = await ctx.db
      .query('users')
      .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', identity.subject))
      .first();
    if (!user) throw appError('USER_NOT_FOUND', 'User not found');

    const membership = await ctx.db
      .query('projectMembers')
      .withIndex('by_project_and_user', (q) =>
        q.eq('projectId', space.projectId).eq('userId', user._id),
      )
      .first();
    if (!membership) throw appError('ACCESS_DENIED', 'Access denied');

    return await ctx.db
      .query('documents')
      .withIndex('by_space_parent_rank', (q) =>
        q.eq('spaceId', args.spaceId).eq('parentId', args.parentId ?? undefined),
      )
      .order('asc')
      .collect();
  },
});

// Update document (title/slug/rank)
export const updateDocument = mutation({
  args: {
    documentId: v.id('documents'),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    rank: v.optional(v.string()),
    iconName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw appError('UNAUTHORIZED', 'Unauthorized');

    const document = await ctx.db.get(args.documentId);
    if (!document) throw appError('DOCUMENT_NOT_FOUND', 'Document not found');

    const space = await ctx.db.get(document.spaceId);
    if (!space) throw appError('SPACE_NOT_FOUND', 'Space not found');

    const user = await ctx.db
      .query('users')
      .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', identity.subject))
      .first();

    if (!user) throw appError('USER_NOT_FOUND', 'User not found');

    // Check membership and permissions
    const membership = await ctx.db
      .query('projectMembers')
      .withIndex('by_project_and_user', (q) =>
        q.eq('projectId', space.projectId).eq('userId', user._id),
      )
      .first();

    if (!membership) throw appError('ACCESS_DENIED', 'Access denied');

    const allowedRoles = ['owner', 'admin', 'editor'];
    if (!allowedRoles.includes(membership.role)) {
      throw appError('WRITE_ACCESS_DENIED', 'Insufficient permissions');
    }

    const updates: { updatedAt: number } & {
      title?: string;
      slug?: string;
      rank?: string;
      iconName?: string;
    } = {
      updatedAt: Date.now(),
    };
    if (args.title !== undefined) {
      updates.title = args.title;
      updates.slug = slugify(args.title);
    }
    if (args.slug !== undefined) updates.slug = slugify(args.slug);
    if (args.rank !== undefined) updates.rank = args.rank;
    if (args.iconName !== undefined) updates.iconName = args.iconName;

    await ctx.db.patch(args.documentId, updates);
    return await ctx.db.get(args.documentId);
  },
});

/* ---------- Delete document and descendants ---------- */

async function collectSubtreeIds(
  ctx: GenericMutationCtx<DataModel>,
  spaceId: Id<'spaces'>,
  rootId: Id<'documents'>,
): Promise<Id<'documents'>[]> {
  const stack: Id<'documents'>[] = [rootId];
  const ordered: Id<'documents'>[] = [];

  while (stack.length) {
    const current = stack.pop() as Id<'documents'>;

    const children = await ctx.db
      .query('documents')
      .withIndex('by_space_parent_rank', (q) => q.eq('spaceId', spaceId).eq('parentId', current))
      .collect();

    for (const child of children) {
      stack.push(child._id);
    }
    ordered.push(current);
  }

  ordered.reverse();
  return ordered;
}

export const deleteDocument = mutation({
  args: { documentId: v.id('documents') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw appError('UNAUTHORIZED', 'Unauthorized');

    const document = await ctx.db.get(args.documentId);
    if (!document) throw appError('DOCUMENT_NOT_FOUND', 'Document not found');

    const space = await ctx.db.get(document.spaceId);
    if (!space) throw appError('SPACE_NOT_FOUND', 'Space not found');

    const user = await ctx.db
      .query('users')
      .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', identity.subject))
      .first();
    if (!user) throw appError('USER_NOT_FOUND', 'User not found');

    const membership = await ctx.db
      .query('projectMembers')
      .withIndex('by_project_and_user', (q) =>
        q.eq('projectId', space.projectId).eq('userId', user._id),
      )
      .first();
    if (!membership) throw appError('ACCESS_DENIED', 'Access denied');

    const allowedRoles = ['owner', 'admin', 'editor'];
    if (!allowedRoles.includes(membership.role)) {
      throw appError('WRITE_ACCESS_DENIED', 'Insufficient permissions');
    }

    const toDelete = await collectSubtreeIds(
      ctx,
      document.spaceId as Id<'spaces'>,
      args.documentId,
    );
    for (const id of toDelete) await ctx.db.delete(id);

    return { success: true, deletedCount: toDelete.length };
  },
});

/* ---------- Types & tree query ---------- */

type DocumentNode = {
  _id: Id<'documents'>;
  type: 'page' | 'group';
  title: string;
  slug: string;
  rank: string;
  parentId?: Id<'documents'>;
  isHidden: boolean;
  pmsDocKey?: string;
  iconName?: string;
};

type TreeNode = DocumentNode & {
  children: TreeNode[];
};

export type { DocumentNode, TreeNode };

export const getTreeForSpace = query({
  args: { spaceId: v.id('spaces') },
  handler: async (ctx, { spaceId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw appError('UNAUTHORIZED', 'Unauthorized');

    const space = await ctx.db.get(spaceId);
    if (!space) throw appError('SPACE_NOT_FOUND', 'Space not found');

    const user = await ctx.db
      .query('users')
      .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', identity.subject))
      .first();
    if (!user) throw appError('USER_NOT_FOUND', 'User not found');

    const membership = await ctx.db
      .query('projectMembers')
      .withIndex('by_project_and_user', (q) =>
        q.eq('projectId', space.projectId).eq('userId', user._id),
      )
      .first();
    if (!membership) throw appError('ACCESS_DENIED', 'Access denied');

    const all = await ctx.db
      .query('documents')
      .withIndex('by_space', (q) => q.eq('spaceId', spaceId))
      .collect();

    const byParent = new Map<string | undefined, DocumentNode[]>();

    for (const d of all) {
      const key = d.parentId ? String(d.parentId) : undefined;
      const arr = byParent.get(key) ?? [];

      const node: DocumentNode = {
        _id: d._id,
        type: d.type,
        title: d.title,
        slug: d.slug,
        rank: d.rank,
        parentId: d.parentId,
        isHidden: !!d.isHidden,
        pmsDocKey: d.pmsDocKey,
        iconName: d.iconName,
      };

      arr.push(node);
      byParent.set(key, arr);
    }

    // Sort siblings by rank
    for (const [, arr] of byParent) {
      arr.sort((a, b) => a.rank.localeCompare(b.rank));
    }

    function attach(node: DocumentNode): TreeNode {
      const children = byParent.get(String(node._id)) ?? [];
      return { ...node, children: children.map(attach) };
    }

    const roots = (byParent.get(undefined) ?? []).map(attach);
    return roots;
  },
});

/* ---------- Move with lexicographic ranks ---------- */

export const moveDocument = mutation({
  args: {
    documentId: v.id('documents'),
    parentId: v.optional(v.id('documents')), // undefined = root
    index: v.number(), // 0-based index within new parent
  },
  handler: async (ctx, { documentId, parentId, index }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw appError('UNAUTHORIZED', 'Unauthorized');

    const doc = await ctx.db.get(documentId);
    if (!doc) throw appError('DOCUMENT_NOT_FOUND', 'Document not found');

    const space = await ctx.db.get(doc.spaceId);
    if (!space) throw appError('SPACE_NOT_FOUND', 'Space not found');

    if (parentId && String(parentId) === String(documentId)) {
      throw appError('INVALID_PARENT', 'A document cannot be its own parent');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', identity.subject))
      .first();
    if (!user) throw appError('USER_NOT_FOUND', 'User not found');

    const membership = await ctx.db
      .query('projectMembers')
      .withIndex('by_project_and_user', (q) =>
        q.eq('projectId', space.projectId).eq('userId', user._id),
      )
      .first();
    if (!membership) throw appError('ACCESS_DENIED', 'Access denied');

    const allowedRoles = ['owner', 'admin', 'editor'];
    if (!allowedRoles.includes(membership.role)) {
      throw appError('WRITE_ACCESS_DENIED', 'Insufficient permissions');
    }

    // Rule: groups must stay at root
    if (doc.type === 'group' && parentId) {
      throw appError('INVALID_PARENT', 'Groups can only exist at top level');
    }

    if (parentId) {
      const parent = await ctx.db.get(parentId);
      if (!parent) throw appError('PARENT_NOT_FOUND', 'Parent not found');
      if (parent.archivedAt) throw appError('PARENT_ARCHIVED', 'Cannot move under archived parent');
      if (doc.type === 'page' && !['group', 'page'].includes(parent.type)) {
        throw appError('INVALID_PARENT', 'Invalid parent type');
      }
    }

    // Siblings in target parent (ordered by rank)
    const siblings = await ctx.db
      .query('documents')
      .withIndex('by_space_parent_rank', (q) =>
        q.eq('spaceId', doc.spaceId).eq('parentId', parentId ?? undefined),
      )
      .order('asc')
      .collect();

    // Exclude the moving doc if it is already in this list
    const filtered = siblings.filter((s) => String(s._id) !== String(doc._id));
    const clampedIndex = Math.max(0, Math.min(index, filtered.length));

    const prev = filtered[clampedIndex - 1];
    const next = filtered[clampedIndex];

    let newRank: string;
    if (prev && next) newRank = rankBetween(prev.rank, next.rank);
    else if (!prev && next) newRank = rankBefore(next.rank);
    else if (prev && !next) newRank = rankAfter(prev.rank);
    else newRank = rankBetween(undefined, undefined);

    await ctx.db.patch(doc._id, {
      parentId: parentId ?? undefined,
      rank: newRank,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(doc._id);
  },
});
