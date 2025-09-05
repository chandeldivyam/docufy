import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import { assertMembership } from './_utils/auth';

// 7 days in milliseconds
const INVITE_EXPIRY_DURATION = 7 * 24 * 60 * 60 * 1000;

export const inviteToProject = mutation({
  args: {
    projectId: v.id('projects'),
    inviteeEmail: v.string(),
    role: v.union(v.literal('admin'), v.literal('editor'), v.literal('viewer')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Check that the inviter has permission (owner or admin)
    const { membership } = await assertMembership(ctx, args.projectId, ['owner', 'admin']);

    // Additional check: only owners can invite admins
    if (args.role === 'admin' && membership.role !== 'owner') {
      throw new Error('Only project owners can invite administrators');
    }

    // Normalize email to lowercase for consistency
    const normalizedEmail = args.inviteeEmail.toLowerCase().trim();

    // Check if user with this email already exists and is a member
    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', normalizedEmail))
      .first();

    if (existingUser) {
      const existingMembership = await ctx.db
        .query('projectMembers')
        .withIndex('by_project_and_user', (q) =>
          q.eq('projectId', args.projectId).eq('userId', existingUser._id),
        )
        .first();

      if (existingMembership) {
        throw new Error('User is already a member of this project');
      }
    }

    // Check if there's already a pending invite for this email to this project
    const existingInvite = await ctx.db
      .query('projectInvites')
      .withIndex('by_project_and_email', (q) =>
        q.eq('projectId', args.projectId).eq('inviteeEmail', normalizedEmail),
      )
      .filter((q) => q.eq(q.field('status'), 'pending'))
      .first();

    if (existingInvite) {
      // Update existing invite instead of creating duplicate
      await ctx.db.patch(existingInvite._id, {
        role: args.role,
        inviterUserId: membership.userId,
        createdAt: Date.now(),
        expiresAt: Date.now() + INVITE_EXPIRY_DURATION,
      });
    } else {
      // Create new invite
      await ctx.db.insert('projectInvites', {
        projectId: args.projectId,
        inviterUserId: membership.userId,
        inviteeEmail: normalizedEmail,
        role: args.role,
        status: 'pending',
        createdAt: Date.now(),
        expiresAt: Date.now() + INVITE_EXPIRY_DURATION,
      });
    }

    return null;
  },
});

export const listProjectInvites = query({
  args: {
    projectId: v.id('projects'),
  },
  returns: v.array(
    v.object({
      _id: v.id('projectInvites'),
      inviteeEmail: v.string(),
      role: v.union(v.literal('admin'), v.literal('editor'), v.literal('viewer')),
      status: v.union(v.literal('pending'), v.literal('accepted'), v.literal('declined')),
      inviterName: v.optional(v.string()),
      createdAt: v.number(),
      expiresAt: v.number(),
      isExpired: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    // Check user has access to view this project
    await assertMembership(ctx, args.projectId);

    const invites = await ctx.db
      .query('projectInvites')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect();

    const invitesWithDetails = await Promise.all(
      invites.map(async (invite) => {
        const inviter = await ctx.db.get(invite.inviterUserId);
        const inviterName = inviter
          ? `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() || inviter.email
          : undefined;

        return {
          _id: invite._id,
          inviteeEmail: invite.inviteeEmail,
          role: invite.role,
          status: invite.status,
          inviterName,
          createdAt: invite.createdAt,
          expiresAt: invite.expiresAt,
          isExpired: invite.status === 'pending' && Date.now() > invite.expiresAt,
        };
      }),
    );

    return invitesWithDetails;
  },
});

export const cancelInvite = mutation({
  args: {
    inviteId: v.id('projectInvites'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) {
      throw new Error('Invite not found');
    }

    // Check that the user has permission to cancel this invite
    await assertMembership(ctx, invite.projectId, ['owner', 'admin']);

    if (invite.status !== 'pending') {
      throw new Error('Can only cancel pending invites');
    }

    await ctx.db.patch(args.inviteId, {
      status: 'declined',
    });

    return null;
  },
});
