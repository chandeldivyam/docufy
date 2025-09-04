import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import { assertMembership } from './_utils/auth';

export const addMember = mutation({
  args: {
    projectId: v.id('projects'),
    userId: v.id('users'),
    role: v.union(v.literal('admin'), v.literal('editor'), v.literal('viewer')),
  },
  handler: async (ctx, { projectId, userId, role }) => {
    await assertMembership(ctx, projectId, ['owner', 'admin']);
    const existing = await ctx.db
      .query('projectMembers')
      .withIndex('by_project_and_user', (q) => q.eq('projectId', projectId).eq('userId', userId))
      .first();
    if (existing) return; // idempotent
    await ctx.db.insert('projectMembers', { projectId, userId, role, createdAt: Date.now() });
  },
});

export const listMembers = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, { projectId }) => {
    await assertMembership(ctx, projectId);
    return await ctx.db
      .query('projectMembers')
      .withIndex('by_project', (q) => q.eq('projectId', projectId))
      .collect();
  },
});
