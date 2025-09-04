import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { getUserOrThrow, assertMembership, type Role } from './_utils/auth';

function slugify(name: string) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${base}-${rand}`;
}

export const create = mutation({
  args: { name: v.string() },
  returns: v.id('projects'),
  handler: async (ctx, args) => {
    const me = await getUserOrThrow(ctx);

    const projectId = await ctx.db.insert('projects', {
      name: args.name,
      slug: slugify(args.name),
      ownerId: me._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.db.insert('projectMembers', {
      projectId,
      userId: me._id,
      role: 'owner',
      createdAt: Date.now(),
    });

    // Set default project if not present
    const freshUser = await ctx.db.get(me._id);
    if (freshUser && !freshUser.defaultProjectId) {
      await ctx.db.patch(me._id, { defaultProjectId: projectId });
    }

    return projectId;
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const me = await getUserOrThrow(ctx);
    const memberships = await ctx.db
      .query('projectMembers')
      .withIndex('by_user', (q) => q.eq('userId', me._id))
      .collect();
    const projects: Array<{ _id: Id<'projects'>; name: string; slug: string; role: Role }> = [];
    for (const m of memberships) {
      const p = await ctx.db.get(m.projectId);
      if (p) projects.push({ _id: p._id, name: p.name, slug: p.slug, role: m.role });
    }
    return projects;
  },
});

export const get = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, args) => {
    await assertMembership(ctx, args.projectId);
    const p = await ctx.db.get(args.projectId);
    return p ?? null;
  },
});

export const rename = mutation({
  args: { projectId: v.id('projects'), name: v.string() },
  handler: async (ctx, args) => {
    await assertMembership(ctx, args.projectId, ['owner', 'admin']);
    await ctx.db.patch(args.projectId, { name: args.name, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { projectId: v.id('projects') },
  handler: async (ctx, args) => {
    await assertMembership(ctx, args.projectId, ['owner']);
    // Remove project memberships
    const mems = await ctx.db
      .query('projectMembers')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect();
    for (const m of mems) await ctx.db.delete(m._id);

    // Phase 2: cascade delete project-scoped data (articles, etc.)

    await ctx.db.delete(args.projectId);
  },
});
