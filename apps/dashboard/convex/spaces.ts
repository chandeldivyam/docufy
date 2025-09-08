import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { assertMembership } from './_utils/auth';
import { appError } from './_utils/errors';

function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

export const create = mutation({
  args: {
    projectId: v.id('projects'),
    name: v.string(),
    description: v.optional(v.string()),
    iconEmoji: v.optional(v.string()),
  },
  returns: v.id('spaces'),
  handler: async (ctx, args) => {
    // Check user has access to this project
    await assertMembership(ctx, args.projectId, ['owner', 'admin', 'editor']);

    const slug = createSlug(args.name);

    // Check if slug already exists in this project
    const existing = await ctx.db
      .query('spaces')
      .withIndex('by_slug', (q) => q.eq('projectId', args.projectId).eq('slug', slug))
      .first();

    if (existing) {
      throw appError('SLUG_EXISTS', 'A space with this name already exists');
    }

    const spaceId = await ctx.db.insert('spaces', {
      projectId: args.projectId,
      name: args.name,
      slug,
      description: args.description,
      iconEmoji: args.iconEmoji,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create a root group document to organize content
    await ctx.db.insert('documents', {
      spaceId,
      type: 'group',
      title: 'Getting Started',
      slug: 'getting-started',
      rank: 'a',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return spaceId;
  },
});

export const list = query({
  args: {
    projectId: v.id('projects'),
  },
  handler: async (ctx, args) => {
    await assertMembership(ctx, args.projectId);

    const spaces = await ctx.db
      .query('spaces')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect();

    return spaces;
  },
});

export const get = query({
  args: {
    spaceId: v.id('spaces'),
  },
  handler: async (ctx, args) => {
    const space = await ctx.db.get(args.spaceId);
    if (!space) return null;

    // Check user has access
    await assertMembership(ctx, space.projectId);

    return space;
  },
});

export const update = mutation({
  args: {
    spaceId: v.id('spaces'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    iconEmoji: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const space = await ctx.db.get(args.spaceId);
    if (!space) {
      throw appError('SPACE_NOT_FOUND', 'Space not found');
    }

    await assertMembership(ctx, space.projectId, ['owner', 'admin', 'editor']);

    const updates: { updatedAt: number } & {
      name?: string;
      slug?: string;
      description?: string;
      iconEmoji?: string;
    } = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      updates.name = args.name;
      updates.slug = createSlug(args.name);
    }

    if (args.description !== undefined) {
      updates.description = args.description;
    }

    if (args.iconEmoji !== undefined) {
      updates.iconEmoji = args.iconEmoji;
    }

    await ctx.db.patch(args.spaceId, updates);
    return null;
  },
});

export const remove = mutation({
  args: {
    spaceId: v.id('spaces'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const space = await ctx.db.get(args.spaceId);
    if (!space) {
      throw appError('SPACE_NOT_FOUND', 'Space not found');
    }

    await assertMembership(ctx, space.projectId, ['owner', 'admin']);

    // Delete all documents in the space
    const documents = await ctx.db
      .query('documents')
      .withIndex('by_space', (q) => q.eq('spaceId', args.spaceId))
      .collect();

    for (const doc of documents) {
      await ctx.db.delete(doc._id);
      // Note: The prosemirror-sync component will handle cleaning up its own data
    }

    await ctx.db.delete(args.spaceId);
    return null;
  },
});
