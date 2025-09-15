// convex/users.ts
import { internalMutation, query } from './_generated/server';
import { v } from 'convex/values';
export const upsertFromClerk = internalMutation({
  args: { data: v.any() },
  returns: v.id('users'),
  handler: async (ctx, args) => {
    const c = args.data;
    const clerkId: string = c.id;
    const imageUrl: string | undefined = c.image_url ?? undefined;

    const primaryEmailId = c.primary_email_address_id as string | undefined;
    const emailAddresses: Array<{
      id: string;
      email_address: string;
      verification: { status?: string } | null;
    }> = Array.isArray(c.email_addresses) ? c.email_addresses : [];
    const primary = primaryEmailId
      ? emailAddresses.find((e) => e.id === primaryEmailId)
      : (emailAddresses.find((e) => e.verification?.status === 'verified') ?? emailAddresses[0]);
    const email = (primary?.email_address ?? '').toLowerCase();

    // Try to find an existing user by Clerk id
    let user =
      (await ctx.db
        .query('users')
        .withIndex('by_external_id', (q) => q.eq('externalId', clerkId))
        .first()) || null;

    // If not found, try by email to merge with WorkOS-created user
    if (!user && email) {
      user = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', email))
        .first();
    }

    const patch = {
      externalId: clerkId,
      email: email || (user?.email ?? ''),
      emailVerified: !!(primary && primary.verification?.status === 'verified'),
      firstName: (c.first_name as string | undefined) || undefined,
      lastName: (c.last_name as string | undefined) || undefined,
      profilePictureUrl: imageUrl,
    };

    if (user) {
      await ctx.db.patch(user._id, patch);
      return user._id;
    } else {
      return await ctx.db.insert('users', {
        ...patch,
        createdAt: Date.now(),
      });
    }
  },
});

export const deleteFromClerk = internalMutation({
  args: { clerkUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, { clerkUserId }) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_external_id', (q) => q.eq('externalId', clerkUserId))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

// Get the current authenticated user document
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    // First try by Clerk external id
    let user = await ctx.db
      .query('users')
      .withIndex('by_external_id', (q) => q.eq('externalId', identity.subject))
      .first();

    // During cutover, optionally fall back by email
    if (!user && identity.email) {
      user = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', identity.email!))
        .first();
    }

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
