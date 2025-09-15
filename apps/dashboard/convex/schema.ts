// convex/schema.ts
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    externalId: v.optional(v.string()),
    email: v.string(),
    emailVerified: v.boolean(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
    createdAt: v.number(),
    defaultProjectId: v.optional(v.id('projects')),
  })
    .index('by_external_id', ['externalId'])
    .index('by_email', ['email']),

  projects: defineTable({
    name: v.string(),
    slug: v.string(),
    ownerId: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_owner', ['ownerId'])
    .index('by_slug', ['slug']),

  projectMembers: defineTable({
    projectId: v.id('projects'),
    userId: v.id('users'),
    role: v.union(v.literal('owner'), v.literal('admin'), v.literal('editor'), v.literal('viewer')),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_project', ['projectId'])
    .index('by_project_and_user', ['projectId', 'userId']),

  projectInvites: defineTable({
    projectId: v.id('projects'),
    inviterUserId: v.id('users'),
    inviteeEmail: v.string(),
    role: v.union(v.literal('admin'), v.literal('editor'), v.literal('viewer')),
    status: v.union(v.literal('pending'), v.literal('accepted'), v.literal('declined')),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index('by_email_and_status', ['inviteeEmail', 'status'])
    .index('by_project', ['projectId'])
    .index('by_project_and_email', ['projectId', 'inviteeEmail']),

  spaces: defineTable({
    projectId: v.id('projects'),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    iconName: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_project', ['projectId'])
    .index('by_slug', ['projectId', 'slug']),

  documents: defineTable({
    spaceId: v.id('spaces'),
    type: v.union(v.literal('page'), v.literal('group')),
    title: v.string(),
    slug: v.string(),
    iconName: v.optional(v.string()),
    parentId: v.optional(v.id('documents')),
    rank: v.string(),
    pmsDocKey: v.optional(v.string()),
    isHidden: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_space', ['spaceId'])
    .index('by_space_parent', ['spaceId', 'parentId'])
    .index('by_space_parent_rank', ['spaceId', 'parentId', 'rank'])
    .index('by_space_parent_slug', ['spaceId', 'parentId', 'slug'])
    .index('by_slug', ['spaceId', 'slug']),

  files: defineTable({
    storageId: v.id('_storage'),
    contentType: v.string(),
    name: v.string(),
    size: v.number(),
    ownerId: v.optional(v.id('users')),
    createdAt: v.number(),
  }).index('by_owner', ['ownerId']),

  sites: defineTable({
    projectId: v.id('projects'),
    storeId: v.string(), // "store_..."
    baseUrl: v.string(), // "https://...public.blob.vercel-storage.com"
    selectedSpaceIds: v.array(v.id('spaces')),
    // Multitenancy: host bindings
    primaryHost: v.optional(v.string()), // e.g. "atlas-a61958e8.trydocufy.com"
    customDomains: v.optional(v.array(v.string())), // e.g. ["docs.acme.com"]
    createdAt: v.number(),
    updatedAt: v.number(),
    lastBuildId: v.optional(v.string()),
    lastPublishedAt: v.optional(v.number()),
  }).index('by_project', ['projectId']),

  siteBuilds: defineTable({
    siteId: v.id('sites'),
    buildId: v.string(), // e.g. Date.now().toString(36)
    status: v.union(
      v.literal('queued'),
      v.literal('running'),
      v.literal('success'),
      v.literal('failed'),
    ),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    itemsTotal: v.number(),
    itemsDone: v.number(),
    pagesWritten: v.number(),
    bytesWritten: v.number(),

    operation: v.union(v.literal('publish'), v.literal('revert')),
    actorUserId: v.id('users'),
    selectedSpaceIdsSnapshot: v.array(v.id('spaces')),
    targetBuildId: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index('by_site', ['siteId'])
    .index('by_build_id', ['buildId']),

  // NEW: Dedup content blobs by hash per project
  siteContentBlobs: defineTable({
    projectId: v.id('projects'),
    hash: v.string(), // sha256 hex of the page bundle JSON
    key: v.string(), // blob key, e.g. "sites/<projectId>/blobs/<hash>.json"
    size: v.number(), // bytes
    createdAt: v.number(),
    lastUsedAt: v.number(),
    // Optional: we could keep a simple ref count if desired later
    refCount: v.optional(v.number()),
  })
    .index('by_project', ['projectId'])
    .index('by_project_hash', ['projectId', 'hash']),
});
