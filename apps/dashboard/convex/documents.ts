import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { appError } from './_utils/errors';
import { Id } from './_generated/dataModel';

function slugify(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

// Create a new document in your database
export const createDocument = mutation({
  args: {
    spaceId: v.id('spaces'),
    title: v.string(),
    slug: v.string(), // client may pass; we’ll normalize
    type: v.union(v.literal('page'), v.literal('group')),
    parentId: v.optional(v.id('documents')),
    order: v.optional(v.number()),
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

    const slug = slugify(args.slug || args.title);
    // we need to ensure that the slug is unique
    const existing = await ctx.db
      .query('documents')
      .withIndex('by_space_parent_slug', (q) =>
        q
          .eq('spaceId', args.spaceId)
          .eq('parentId', args.parentId ?? undefined)
          .eq('slug', slug),
      )
      .first();
    if (existing) throw appError('SLUG_EXISTS', 'A document with this slug already exists here');

    // Determine order (last sibling + 1) using "by_space_parent_order"
    let order = args.order;
    if (order === undefined) {
      const last = await ctx.db
        .query('documents')
        .withIndex('by_space_parent_order', (q) =>
          q.eq('spaceId', args.spaceId).eq('parentId', args.parentId ?? undefined),
        )
        .order('desc')
        .first();
      order = last ? last.order + 1 : 0;
    }

    const now = Date.now();
    const docId = await ctx.db.insert('documents', {
      spaceId: args.spaceId,
      type: args.type,
      title: args.title,
      slug,
      parentId: args.parentId,
      order,
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

    return document;
  },
});

// Get documents in a space
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
      .withIndex('by_space_parent_order', (q) =>
        q.eq('spaceId', args.spaceId).eq('parentId', args.parentId ?? undefined),
      )
      .order('asc')
      .collect();
  },
});

// Update document
export const updateDocument = mutation({
  args: {
    documentId: v.id('documents'),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    order: v.optional(v.number()),
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

    // Update the document
    const updates: { updatedAt: number } & { title?: string; slug?: string; order?: number } = {
      updatedAt: Date.now(),
    };
    if (args.title !== undefined) updates.title = args.title;
    if (args.slug !== undefined) updates.slug = args.slug;
    if (args.order !== undefined) updates.order = args.order;

    await ctx.db.patch(args.documentId, updates);
    return await ctx.db.get(args.documentId);
  },
});

// Delete document
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

    // Mark as archived instead of deleting
    await ctx.db.patch(args.documentId, {
      archivedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

type DocumentNode = {
  _id: Id<'documents'>;
  type: 'page' | 'group';
  title: string;
  slug: string;
  order: number;
  parentId?: Id<'documents'>;
  isHidden: boolean;
  pmsDocKey?: string;
};

// Define the tree node type (document node with children)
type TreeNode = DocumentNode & {
  children: TreeNode[];
};

// Export these types so the frontend can use them
export type { DocumentNode, TreeNode };

// Updated getTreeForSpace query with proper types
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

    // Load all docs in the space
    const all = await ctx.db
      .query('documents')
      .withIndex('by_space', (q) => q.eq('spaceId', spaceId))
      .collect();

    // Group by parent with proper typing
    const byParent = new Map<string | undefined, DocumentNode[]>();

    for (const d of all) {
      const key = d.parentId ? String(d.parentId) : undefined;
      const arr = byParent.get(key) ?? [];

      const node: DocumentNode = {
        _id: d._id,
        type: d.type,
        title: d.title,
        slug: d.slug,
        order: d.order,
        parentId: d.parentId,
        isHidden: !!d.isHidden,
        // For pages, we'll need the editor key later
        pmsDocKey: d.pmsDocKey,
      };

      arr.push(node);
      byParent.set(key, arr);
    }

    // Sort siblings by "order"
    for (const [k, arr] of byParent) {
      if (k === undefined) continue;
      arr.sort((a, b) => a.order - b.order);
    }

    // Build nested tree with proper typing
    function attach(node: DocumentNode): TreeNode {
      const children = byParent.get(String(node._id)) ?? [];
      return {
        ...node,
        children: children.map(attach),
      };
    }

    const roots = (byParent.get(undefined) ?? []).map(attach);
    return roots;
  },
});
