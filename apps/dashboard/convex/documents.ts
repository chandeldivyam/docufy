import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { appError } from './_utils/errors';

// Create a new document in your database
export const createDocument = mutation({
  args: {
    spaceId: v.id('spaces'),
    title: v.string(),
    slug: v.string(),
    type: v.union(v.literal('page'), v.literal('group')),
    parentId: v.optional(v.id('documents')),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check permissions first
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw appError('UNAUTHORIZED', 'Unauthorized');

    const user = await ctx.db
      .query('users')
      .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', identity.subject))
      .first();

    if (!user) throw appError('USER_NOT_FOUND', 'User not found');

    const space = await ctx.db.get(args.spaceId);
    if (!space) throw appError('SPACE_NOT_FOUND', 'Space not found');

    // Check membership
    const membership = await ctx.db
      .query('projectMembers')
      .withIndex('by_project_and_user', (q) =>
        q.eq('projectId', space.projectId).eq('userId', user._id),
      )
      .first();

    if (!membership) throw appError('ACCESS_DENIED', 'Access denied');

    // Check write permissions
    const allowedRoles = ['owner', 'admin', 'editor'];
    if (!allowedRoles.includes(membership.role)) {
      throw appError('WRITE_ACCESS_DENIED', 'Insufficient permissions');
    }

    // Get the next order value if not provided
    let order = args.order;
    if (order === undefined) {
      const lastDoc = await ctx.db
        .query('documents')
        .withIndex('by_space_parent', (q) =>
          q.eq('spaceId', args.spaceId).eq('parentId', args.parentId),
        )
        .order('desc')
        .first();

      order = lastDoc ? lastDoc.order + 1 : 0;
    }

    const now = Date.now();

    // Create the document record first without pmsDocKey
    const documentId = await ctx.db.insert('documents', {
      spaceId: args.spaceId,
      type: args.type,
      title: args.title,
      slug: args.slug,
      parentId: args.parentId,
      order,
      createdAt: now,
      updatedAt: now,
    });

    // For page type documents, update with the ProseMirror sync key now that we have the ID
    if (args.type === 'page') {
      const pmsDocKey = `space/${args.spaceId}/doc/${documentId}`;
      await ctx.db.patch(documentId, {
        pmsDocKey,
      });
    }

    // Return the updated document
    return await ctx.db.get(documentId);
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
  args: {
    spaceId: v.id('spaces'),
    parentId: v.optional(v.id('documents')),
  },
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

    // Check membership
    const membership = await ctx.db
      .query('projectMembers')
      .withIndex('by_project_and_user', (q) =>
        q.eq('projectId', space.projectId).eq('userId', user._id),
      )
      .first();

    if (!membership) throw appError('ACCESS_DENIED', 'Access denied');

    return await ctx.db
      .query('documents')
      .withIndex('by_space_parent', (q) =>
        q.eq('spaceId', args.spaceId).eq('parentId', args.parentId),
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
