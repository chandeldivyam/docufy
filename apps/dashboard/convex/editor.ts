import { ProsemirrorSync } from '@convex-dev/prosemirror-sync';
import { components } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { appError } from './_utils/errors';

const pms = new ProsemirrorSync(components.prosemirrorSync);

// Helper to parse document keys
function parseDocKey(docKey: string) {
  // Format: "space/<spaceId>/doc/<documentId>"
  const parts = docKey.split('/');
  if (parts.length !== 4 || parts[0] !== 'space' || parts[2] !== 'doc') {
    throw new Error('Invalid document key format');
  }
  return {
    spaceId: parts[1] as Id<'spaces'>,
    documentId: parts[3] as Id<'documents'>,
  };
}

export const { getSnapshot, submitSnapshot, latestVersion, getSteps, submitSteps } = pms.syncApi({
  checkRead: async (ctx, id) => {
    try {
      const { spaceId } = parseDocKey(id);

      // Use the generic context methods directly
      const space = await ctx.db.get(spaceId);
      if (!space) throw appError('SPACE_NOT_FOUND', 'Space not found');
      const projectId = (space as { projectId?: Id<'projects'> }).projectId;
      if (!projectId) throw appError('PROJECT_ID_NOT_FOUND', 'Project ID not found');

      // Check user has access to the project
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) throw appError('UNAUTHORIZED', 'Unauthorized');

      const user = await ctx.db
        .query('users')
        .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', identity.subject))
        .first();

      if (!user) throw appError('USER_NOT_FOUND', 'User not found');

      const membership = await ctx.db
        .query('projectMembers')
        .withIndex('by_project_and_user', (q) => q.eq('projectId', projectId))
        .filter((q) => q.eq(q.field('userId'), user._id))
        .first();

      if (!membership) throw appError('ACCESS_DENIED', 'Access denied');
    } catch (error) {
      throw appError(
        'READ_ACCESS_DENIED',
        `Read access denied: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  },

  checkWrite: async (ctx, id) => {
    try {
      const { spaceId } = parseDocKey(id);

      const space = await ctx.db.get(spaceId);
      if (!space) throw appError('SPACE_NOT_FOUND', 'Space not found');
      const projectId = (space as { projectId?: Id<'projects'> }).projectId;
      if (!projectId) throw appError('PROJECT_ID_NOT_FOUND', 'Project ID not found');

      const identity = await ctx.auth.getUserIdentity();
      if (!identity) throw appError('UNAUTHORIZED', 'Unauthorized');

      const user = await ctx.db
        .query('users')
        .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', identity.subject))
        .first();

      if (!user) throw appError('USER_NOT_FOUND', 'User not found');

      const membership = await ctx.db
        .query('projectMembers')
        .withIndex('by_project_and_user', (q) => q.eq('projectId', projectId))
        .filter((q) => q.eq(q.field('userId'), user._id))
        .first();

      if (!membership) throw appError('ACCESS_DENIED', 'Access denied');

      if (!membership.role || typeof membership.role !== 'string')
        throw appError('ACCESS_DENIED', 'Access denied');

      // Only editors and above can write
      const allowedRoles = ['owner', 'admin', 'editor'];
      if (!allowedRoles.includes(membership.role)) {
        throw appError('WRITE_ACCESS_DENIED', 'Write access denied - insufficient permissions');
      }
    } catch (error) {
      throw appError(
        'WRITE_ACCESS_DENIED',
        `Write access denied: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  },

  onSnapshot: async (ctx, id) => {
    try {
      // Update the document's updatedAt timestamp
      const { documentId } = parseDocKey(id);
      const doc = await ctx.db.get(documentId);
      if (doc) {
        await ctx.db.patch(documentId, {
          updatedAt: Date.now(),
        });
      }
    } catch (error) {
      // Log but don't throw - this is a side effect
      console.log('Failed to update document timestamp:', error);
    }
  },
});

export const getDoc = pms.getDoc.bind(pms);
export const transform = pms.transform.bind(pms);
