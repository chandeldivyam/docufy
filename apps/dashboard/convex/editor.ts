import { ProsemirrorSync } from '@convex-dev/prosemirror-sync';
import { components } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { appError } from './_utils/errors';
import { assertMembershipGenericCtx } from './_utils/auth';

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

      // Any project member (viewer+) can read
      await assertMembershipGenericCtx(ctx, projectId);
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

      // Editors and above can write
      await assertMembershipGenericCtx(ctx, projectId, ['owner', 'admin', 'editor']);
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
