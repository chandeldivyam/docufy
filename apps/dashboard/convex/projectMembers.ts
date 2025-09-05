import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import { assertMembership } from './_utils/auth';
import { ConvexError } from 'convex/values';

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

export const updateMemberRole = mutation({
  args: {
    memberId: v.id('projectMembers'),
    newRole: v.union(v.literal('admin'), v.literal('editor'), v.literal('viewer')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const memberToUpdate = await ctx.db.get(args.memberId);
    if (!memberToUpdate) {
      throw new ConvexError('Member not found');
    }

    // Check permissions
    const { membership } = await assertMembership(ctx, memberToUpdate.projectId, [
      'owner',
      'admin',
    ]);

    // Can't change owner's role
    if (memberToUpdate.role === 'owner') {
      throw new ConvexError('Cannot change owner role');
    }

    // Only owner can promote/demote admins
    if (
      (memberToUpdate.role === 'admin' || args.newRole === 'admin') &&
      membership.role !== 'owner'
    ) {
      throw new ConvexError('Only project owners can manage administrator roles');
    }

    // Can't change your own role
    if (memberToUpdate.userId === membership.userId) {
      throw new ConvexError('You cannot change your own role');
    }

    await ctx.db.patch(args.memberId, { role: args.newRole });
    return null;
  },
});

export const removeMember = mutation({
  args: {
    memberId: v.id('projectMembers'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const memberToRemove = await ctx.db.get(args.memberId);
    if (!memberToRemove) {
      throw new ConvexError('Member not found');
    }

    // Check permissions
    const { membership } = await assertMembership(ctx, memberToRemove.projectId, [
      'owner',
      'admin',
    ]);

    // Can't remove owner
    if (memberToRemove.role === 'owner') {
      throw new ConvexError('Cannot remove project owner');
    }

    // Only owner can remove admins
    if (memberToRemove.role === 'admin' && membership.role !== 'owner') {
      throw new ConvexError('Only project owners can remove administrators');
    }

    // Can't remove yourself
    if (memberToRemove.userId === membership.userId) {
      throw new ConvexError('You cannot remove yourself from the project');
    }

    await ctx.db.delete(args.memberId);
    return null;
  },
});

export const listMembers = query({
  args: { projectId: v.id('projects') },
  returns: v.array(
    v.object({
      _id: v.id('projectMembers'),
      userId: v.id('users'),
      role: v.union(
        v.literal('owner'),
        v.literal('admin'),
        v.literal('editor'),
        v.literal('viewer'),
      ),
      createdAt: v.number(),
      user: v.optional(
        v.object({
          email: v.string(),
          firstName: v.optional(v.string()),
          lastName: v.optional(v.string()),
        }),
      ),
    }),
  ),
  handler: async (ctx, { projectId }) => {
    await assertMembership(ctx, projectId);

    const members = await ctx.db
      .query('projectMembers')
      .withIndex('by_project', (q) => q.eq('projectId', projectId))
      .collect();

    const membersWithUserInfo = await Promise.all(
      members.map(async (member) => {
        const user = await ctx.db.get(member.userId);
        return {
          _id: member._id,
          userId: member.userId,
          role: member.role,
          createdAt: member.createdAt,
          user: user
            ? {
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
              }
            : undefined,
        };
      }),
    );

    return membersWithUserInfo;
  },
});
