import type { QueryCtx, MutationCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { ConvexError } from 'convex/values';

export type Role = 'owner' | 'admin' | 'editor' | 'viewer';

export async function getUserOrThrow(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Unauthorized');
  const user = await ctx.db
    .query('users')
    .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', identity.subject))
    .first();
  if (!user) throw new ConvexError('User not found');
  return user;
}

export async function assertMembership(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<'projects'>,
  allowed: Role[] = ['owner', 'admin', 'editor', 'viewer'],
) {
  const me = await getUserOrThrow(ctx);
  const membership = await ctx.db
    .query('projectMembers')
    .withIndex('by_project_and_user', (q) => q.eq('projectId', projectId).eq('userId', me._id))
    .first();
  if (!membership || !allowed.includes(membership.role)) {
    throw new ConvexError('Forbidden');
  }
  return { me, membership };
}
