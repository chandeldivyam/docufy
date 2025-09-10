import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getUserOrThrow } from './_utils/auth';

// 1) Get a signed URL to upload directly to Convex storage
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const url = await ctx.storage.generateUploadUrl();
    return url;
  },
});

// 2) Persist file metadata and return a public URL to serve the file
export const store = mutation({
  args: {
    storageId: v.id('_storage'),
    contentType: v.string(),
    name: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    const me = await getUserOrThrow(ctx);
    const fileId = await ctx.db.insert('files', {
      ...args,
      ownerId: me._id,
      createdAt: Date.now(),
    });
    const url = await ctx.storage.getUrl(args.storageId);
    // url can be used directly in <img src="...">. Access control can be done at query time. :contentReference[oaicite:1]{index=1}
    return { fileId, url };
  },
});

// (Optional) Resolve a URL again later by metadata id
export const getUrl = query({
  args: { fileId: v.id('files') },
  handler: async (ctx, { fileId }) => {
    const file = await ctx.db.get(fileId);
    if (!file) return null;
    return await ctx.storage.getUrl(file.storageId);
  },
});
