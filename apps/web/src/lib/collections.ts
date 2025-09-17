import { createCollection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import {
  selectUsersSchema,
  selectOrganizationsSchema,
  selectMembersSchema,
} from "@/db/schema"
import { z } from "zod"

const electricParsers = {
  // parse both timestamp flavors into JS Date
  timestamp: (d: string) => new Date(d),
  timestamptz: (d: string) => new Date(d),
  date: (d: string) => new Date(d),
}

// Fix: Use proper URL construction that works in both SSR and client
function getApiUrl(path: string): string {
  if (typeof window !== "undefined") {
    return new URL(path, window.location.origin).toString()
  }
  // During SSR, use the configured base URL
  const baseUrl = process.env.PUBLIC_URL || "http://localhost:5173"
  return new URL(path, baseUrl).toString()
}

// Invitation rows come back in snake_case, so parse then map to camelCase
const invitationRowSchema = z
  .object({
    id: z.string(),
    organization_id: z.string(),
    email: z.string().email(),
    role: z.string().nullable().optional(),
    status: z.string(),
    expires_at: z.coerce.date(), // coerce string -> Date
    inviter_id: z.string(),
  })
  .transform((r) => ({
    id: r.id,
    organizationId: r.organization_id,
    email: r.email,
    role: r.role ?? "member",
    status: r.status,
    expiresAt: r.expires_at,
    inviterId: r.inviter_id,
  }))

export const invitationsCollection = createCollection(
  electricCollectionOptions({
    id: "invitations",
    shapeOptions: {
      url: getApiUrl("/api/invitations"),
      parser: electricParsers, // <-- parse timestamp
    },
    schema: invitationRowSchema, // <-- not selectInvitationsSchema
    getKey: (item) => item.id,
  })
)

// Invitations addressed to the current user (pending only)
export const userInvitationsCollection = createCollection(
  electricCollectionOptions({
    id: "user-invitations",
    shapeOptions: {
      url: getApiUrl("/api/user-invitations"),
      parser: electricParsers,
    },
    schema: invitationRowSchema,
    getKey: (item) => item.id,
  })
)

// Do the same parser for users, organizations, members
export const usersCollection = createCollection(
  electricCollectionOptions({
    id: "users",
    shapeOptions: { url: getApiUrl("/api/users"), parser: electricParsers },
    schema: selectUsersSchema, // this one already matches camelCase ok if your schema transform handles it
    getKey: (item) => item.id,
  })
)

export const organizationsCollection = createCollection(
  electricCollectionOptions({
    id: "organizations",
    shapeOptions: {
      url: getApiUrl("/api/organizations"),
      parser: electricParsers,
    },
    schema: selectOrganizationsSchema,
    getKey: (item) => item.id,
  })
)

export const membersCollection = createCollection(
  electricCollectionOptions({
    id: "members",
    shapeOptions: { url: getApiUrl("/api/members"), parser: electricParsers },
    schema: selectMembersSchema,
    getKey: (item) => item.id,
  })
)

const orgUserProfilesRawSchema = z.object({
  organization_id: z.string(),
  user_id: z.string(),
  role: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  image: z.string().nullable(),
  created_at: z.coerce.date(),
})

export const orgUserProfilesCollection = createCollection(
  electricCollectionOptions({
    id: "org-user-profiles",
    shapeOptions: {
      url: getApiUrl("/api/org-user-profiles"),
      parser: electricParsers,
    },
    schema: orgUserProfilesRawSchema,
    getKey: (item) => `${item.organization_id}:${item.user_id}`,
  })
)
