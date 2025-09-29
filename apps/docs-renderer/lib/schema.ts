// apps/docs-renderer/lib/schema.ts
import { z } from 'zod';

export const NavSpaceZ = z.object({
  slug: z.string(),
  name: z.string(),
  style: z.enum(['dropdown', 'tab']),
  order: z.number().optional(),
  iconName: z.string().optional(),
  entry: z.string().optional(),
});

export const PageIndexEntryZ = z.object({
  title: z.string(),
  space: z.string(),
  // icon name could be undefined so be careful
  iconName: z.string().optional().nullable(),
  blob: z.string(),
  hash: z.string(),
  size: z.number(),
  neighbors: z.array(z.string()).optional().default([]),
  lastModified: z.number().optional(),
  kind: z.enum(['page', 'api_spec', 'api']).optional().nullable(),
  api: z
    .object({
      document: z.string().optional(),
      path: z.string().optional(),
      method: z.string().optional(),
    })
    .optional()
    .nullable(),
});

export const ManifestZ = z.object({
  version: z.literal(3),
  contentVersion: z.string(),
  buildId: z.string(),
  publishedAt: z.number(),
  site: z.object({
    projectId: z.string().optional(),
    layout: z.enum(['sidebar-dropdown', 'sidebar-tabs']),
    baseUrl: z.string().url(),
    name: z.string().nullable().optional(),
    logoUrl: z.string().nullable().optional(),
  }),
  routing: z.object({ basePath: z.string(), defaultSpace: z.string() }),
  nav: z.object({ spaces: z.array(NavSpaceZ) }),
  counts: z.object({ pages: z.number(), newBlobs: z.number(), reusedBlobs: z.number() }),
  pages: z.record(z.string(), PageIndexEntryZ),
});

export const TreeZ = z.object({
  version: z.literal(2),
  buildId: z.string(),
  publishedAt: z.number(),
  nav: z.object({
    spaces: z.array(
      z.object({
        slug: z.string(),
        name: z.string(),
        order: z.number().optional(),
        iconName: z.string().optional(),
      }),
    ),
  }),
  spaces: z.array(
    z.object({
      space: z.object({ slug: z.string(), name: z.string(), iconName: z.string().optional() }),
      items: z.any(),
    }),
  ),
});
