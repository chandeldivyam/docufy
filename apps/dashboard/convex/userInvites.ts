import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import { getUserOrThrow } from './_utils/auth';
import { appError } from './_utils/errors';

export const listMyPendingInvites = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id('projectInvites'),
      projectId: v.id('projects'),
      projectName: v.string(),
      role: v.union(v.literal('admin'), v.literal('editor'), v.literal('viewer')),
      inviterName: v.optional(v.string()),
      createdAt: v.number(),
      expiresAt: v.number(),
      isExpired: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const user = await getUserOrThrow(ctx);

    // Get all pending invites for this user's email
    const invites = await ctx.db
      .query('projectInvites')
      .withIndex('by_email_and_status', (q) =>
        q.eq('inviteeEmail', user.email.toLowerCase()).eq('status', 'pending'),
      )
      .collect();

    const invitesWithDetails = await Promise.all(
      invites.map(async (invite) => {
        const project = await ctx.db.get(invite.projectId);
        if (!project) {
          // Project was deleted, skip this invite
          return null;
        }

        const inviter = await ctx.db.get(invite.inviterUserId);
        const inviterName = inviter
          ? `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() || inviter.email
          : undefined;

        return {
          _id: invite._id,
          projectId: invite.projectId,
          projectName: project.name,
          role: invite.role,
          inviterName,
          createdAt: invite.createdAt,
          expiresAt: invite.expiresAt,
          isExpired: Date.now() > invite.expiresAt,
        };
      }),
    );

    // Filter out null values (deleted projects) and return
    return invitesWithDetails.filter(
      (invite): invite is NonNullable<typeof invite> => invite !== null,
    );
  },
});

export const acceptInvite = mutation({
  args: {
    inviteId: v.id('projectInvites'),
    setAsDefault: v.optional(v.boolean()),
  },
  returns: v.object({
    projectId: v.id('projects'),
  }),
  handler: async (ctx, args) => {
    const user = await getUserOrThrow(ctx);

    const invite = await ctx.db.get(args.inviteId);
    if (!invite) {
      throw appError('INVITE_NOT_FOUND', 'Invite not found');
    }

    // Verify the invite is for this user
    if (invite.inviteeEmail.toLowerCase() !== user.email.toLowerCase()) {
      throw appError('THIS_INVITE_IS_NOT_FOR_YOU', 'This invite is not for you');
    }

    // Check invite status
    if (invite.status !== 'pending') {
      throw appError(
        'THIS_INVITE_HAS_ALREADY_BEEN_PROCESSED',
        'This invite has already been processed',
      );
    }

    // Check if invite has expired
    if (Date.now() > invite.expiresAt) {
      throw appError('THIS_INVITE_HAS_EXPIRED', 'This invite has expired');
    }

    // Check if project still exists
    const project = await ctx.db.get(invite.projectId);
    if (!project) {
      throw appError('PROJECT_NO_LONGER_EXISTS', 'Project no longer exists');
    }

    // Check if user is already a member (shouldn't happen, but double-check)
    const existingMembership = await ctx.db
      .query('projectMembers')
      .withIndex('by_project_and_user', (q) =>
        q.eq('projectId', invite.projectId).eq('userId', user._id),
      )
      .first();

    if (existingMembership) {
      // Already a member, just mark invite as accepted
      await ctx.db.patch(invite._id, { status: 'accepted' });
      return { projectId: invite.projectId };
    }

    // Add user to project members
    await ctx.db.insert('projectMembers', {
      projectId: invite.projectId,
      userId: user._id,
      role: invite.role,
      createdAt: Date.now(),
    });

    // Mark invite as accepted
    await ctx.db.patch(invite._id, { status: 'accepted' });

    // Optionally set as default project
    if (args.setAsDefault || !user.defaultProjectId) {
      await ctx.db.patch(user._id, { defaultProjectId: invite.projectId });
    }

    return { projectId: invite.projectId };
  },
});

export const declineInvite = mutation({
  args: {
    inviteId: v.id('projectInvites'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getUserOrThrow(ctx);

    const invite = await ctx.db.get(args.inviteId);
    if (!invite) {
      throw appError('INVITE_NOT_FOUND', 'Invite not found');
    }

    // Verify the invite is for this user
    if (invite.inviteeEmail.toLowerCase() !== user.email.toLowerCase()) {
      throw appError('THIS_INVITE_IS_NOT_FOR_YOU', 'This invite is not for you');
    }

    // Check invite status
    if (invite.status !== 'pending') {
      throw appError(
        'THIS_INVITE_HAS_ALREADY_BEEN_PROCESSED',
        'This invite has already been processed',
      );
    }

    // Mark invite as declined
    await ctx.db.patch(invite._id, { status: 'declined' });

    return null;
  },
});
