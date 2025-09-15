import type { QueryCtx, MutationCtx, GenericCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { appError } from './errors';
import { api } from '../_generated/api';
import { GenericDataModel, GenericQueryCtx } from 'convex/server';

export type Role = 'owner' | 'admin' | 'editor' | 'viewer';

export async function getUserOrThrow(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw appError('UNAUTHORIZED', 'Unauthorized');

  // 1) Primary: Clerk id (subject)
  const user = await ctx.db
    .query('users')
    .withIndex('by_external_id', (q) => q.eq('externalId', identity.subject))
    .first();

  if (!user) throw appError('USER_NOT_FOUND', 'User not found');
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
    throw appError('FORBIDDEN', 'Forbidden');
  }
  return { me, membership };
}

export async function getUserOrThrowGenericCtx(ctx: GenericCtx | GenericQueryCtx<GenericDataModel>) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw appError('UNAUTHORIZED', 'Unauthorized');

  const user = await ctx.runQuery(api.users.getCurrentUser, {})

  if (!user) throw appError('USER_NOT_FOUND', 'User not found');
  return user;
}

export async function assertMembershipGenericCtx(
  ctx: GenericCtx | GenericQueryCtx<GenericDataModel>,
  projectId: Id<'projects'>,
  allowed: Role[] = ['owner', 'admin', 'editor', 'viewer']
) {
  const me = await getUserOrThrowGenericCtx(ctx);
  const membership = await ctx.runQuery(api.projectMembers.listMembers, {
    projectId,
  });
  const userMembership = membership.find((m) => m.userId === me._id);
  if (!userMembership || !allowed.includes(userMembership.role)) {
    throw appError('FORBIDDEN', 'Forbidden');
  }
  return { me, userMembership };
}
