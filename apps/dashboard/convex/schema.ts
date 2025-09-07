// convex/schema.ts
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    // WorkOS user ID (their unique identifier)
    workosUserId: v.string(),

    // Basic user info
    email: v.string(),
    emailVerified: v.boolean(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),

    // Timestamps
    createdAt: v.number(),

    // Default project to use for redirects when no cookie is set
    defaultProjectId: v.optional(v.id('projects')),
  })
    .index('by_workos_user_id', ['workosUserId'])
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
    iconEmoji: v.optional(v.string()),
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

    parentId: v.optional(v.id('documents')),
    order: v.number(), // sibling ordering key

    // For pages only (editor doc key)
    pmsDocKey: v.optional(v.string()),

    // Visibility & lifecycle
    isHidden: v.optional(v.boolean()), // default false
    archivedAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_space', ['spaceId'])
    .index('by_space_parent', ['spaceId', 'parentId'])
    .index('by_space_parent_order', ['spaceId', 'parentId', 'order']) // ← enables proper ordered queries
    .index('by_space_parent_slug', ['spaceId', 'parentId', 'slug']) // ← uniqueness check scoped to siblings
    .index('by_slug', ['spaceId', 'slug']), // keep if you still want space-wide slug lookups
});
