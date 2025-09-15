// This file previously contained WorkOS webhook verification.
// WorkOS has been fully removed in favor of Clerk. We keep a no-op
// export so Convex' generated API typings remain stable until the
// next codegen run removes this module from the API map.

import { internalAction } from './_generated/server';
import { v } from 'convex/values';
import { appError } from './_utils/errors';

export const verifyWebhook = internalAction({
  args: v.object({
    payload: v.string(),
    signature: v.string(),
  }),
  handler: async () => {
    throw appError('GONE', 'WorkOS integration has been removed.');
  },
});
