// apps/dashboard/lib/convexHooks.ts
import { useQueries } from 'convex/react';
import { makeUseQueryWithStatus } from 'convex-helpers/react';

// 1) Status-aware query hook so you never guess on undefined vs loading vs error
export const useQueryWithStatus = makeUseQueryWithStatus(useQueries);
