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
  })
    .index('by_workos_user_id', ['workosUserId'])
    .index('by_email', ['email']),
});
