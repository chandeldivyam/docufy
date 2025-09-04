// convex/users.ts
import { internalMutation, query } from './_generated/server';
import { v } from 'convex/values';

// This will be called by the WorkOS webhook when a user is created/updated
export const syncFromWorkOS = internalMutation({
  args: {
    workosUserId: v.string(),
    email: v.string(),
    emailVerified: v.boolean(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
  },
  returns: v.id('users'),
  handler: async (ctx, args) => {
    // Check if user exists
    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', args.workosUserId))
      .first();

    if (existingUser) {
      // Update existing user
      await ctx.db.patch(existingUser._id, {
        email: args.email,
        emailVerified: args.emailVerified,
        firstName: args.firstName,
        lastName: args.lastName,
        profilePictureUrl: args.profilePictureUrl,
      });
      return existingUser._id;
    } else {
      // Create new user
      return await ctx.db.insert('users', {
        workosUserId: args.workosUserId,
        email: args.email,
        emailVerified: args.emailVerified,
        firstName: args.firstName,
        lastName: args.lastName,
        profilePictureUrl: args.profilePictureUrl,
        createdAt: Date.now(),
      });
    }
  },
});

// Get the current authenticated user
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query('users')
      .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', identity.subject))
      .first();

    if (!user) return null;

    return {
      _id: user._id,
      email: user.email,
      emailVerified: user.emailVerified,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePictureUrl: user.profilePictureUrl,
      defaultProjectId: user.defaultProjectId,
    };
  },
});
