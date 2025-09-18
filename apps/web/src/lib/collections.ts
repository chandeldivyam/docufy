import {
  createCollection,
  localOnlyCollectionOptions,
} from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import { z } from "zod"
import { trpc } from "@/lib/trpc-client"

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

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80)
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

// Per-org invitations collection (org-scoped shape)
type InvitationsCollection = typeof invitationsCollection
const invitationsByOrg = new Map<string, InvitationsCollection>()
export function getOrgInvitationsCollection(
  orgId: string
): InvitationsCollection {
  let col = invitationsByOrg.get(orgId)
  if (!col) {
    col = createCollection(
      electricCollectionOptions({
        id: `invitations-${orgId}`,
        shapeOptions: {
          url: getApiUrl(`/api/invitations?orgId=${orgId}`),
          parser: electricParsers,
        },
        schema: invitationRowSchema,
        getKey: (item) => item.id,
      })
    ) as InvitationsCollection
    invitationsByOrg.set(orgId, col)
  }
  return col
}

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

const orgUserProfilesRawSchema = z.object({
  organization_id: z.string(),
  user_id: z.string(),
  role: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  image: z.string().nullable(),
  created_at: z.coerce.date(),
  org_logo: z.string().nullable(),
  org_slug: z.string(),
  org_name: z.string(),
})

export type OrgUserProfileRow = z.infer<typeof orgUserProfilesRawSchema>

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

// Local empty collections for stable hooks before orgId is known
export const emptyOrgUserProfilesCollection = createCollection(
  localOnlyCollectionOptions({
    id: "empty-org-user-profiles",
    schema: orgUserProfilesRawSchema,
    getKey: (item) => `${item.organization_id}:${item.user_id}`,
  })
)
export const emptyInvitationsCollection = createCollection(
  localOnlyCollectionOptions({
    id: "empty-invitations",
    schema: invitationRowSchema,
    getKey: (item) => item.id,
  })
)

// Per-org org_user_profiles collection (org-scoped shape)
type OrgUserProfilesCollection = typeof orgUserProfilesCollection
const orgUserProfilesByOrg = new Map<string, OrgUserProfilesCollection>()
export function getOrgUserProfilesCollection(
  orgId: string
): OrgUserProfilesCollection {
  let col = orgUserProfilesByOrg.get(orgId)
  if (!col) {
    col = createCollection(
      electricCollectionOptions({
        id: `org-user-profiles-${orgId}`,
        shapeOptions: {
          url: getApiUrl(`/api/org-user-profiles?orgId=${orgId}`),
          parser: electricParsers,
        },
        schema: orgUserProfilesRawSchema,
        getKey: (item) => `${item.organization_id}:${item.user_id}`,
      })
    ) as OrgUserProfilesCollection
    orgUserProfilesByOrg.set(orgId, col)
  }
  return col
}

export const myOrganizationsCollection = createCollection(
  electricCollectionOptions({
    id: "my-organizations",
    shapeOptions: {
      url: getApiUrl("/api/my-organizations"),
      parser: electricParsers,
    },
    schema: orgUserProfilesRawSchema,
    getKey: (item) => item.organization_id,
  })
)

const spacesRawSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  icon_name: z.string().nullable().optional(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type SpaceRow = z.infer<typeof spacesRawSchema>

function createSpacesCollectionFor(url: string) {
  return createCollection(
    electricCollectionOptions({
      id: `spaces:${url}`,
      shapeOptions: {
        url,
        parser: electricParsers,
      },
      schema: spacesRawSchema,
      getKey: (item) => item.id,

      onInsert: async ({ transaction }) => {
        const { modified: row } = transaction.mutations[0]
        const result = await trpc.spaces.create.mutate({
          id: row.id,
          organizationId: row.organization_id,
          name: row.name,
          slug: row.slug,
          description: row.description ?? undefined,
          iconName: row.icon_name ?? undefined,
        })
        return { txid: result.txid }
      },

      onUpdate: async ({ transaction }) => {
        const { original: prev, modified: next } = transaction.mutations[0]
        const result = await trpc.spaces.update.mutate({
          id: prev.id,
          name: next.name !== prev.name ? next.name : undefined,
          slug: next.slug !== prev.slug ? next.slug : undefined,
          description:
            next.description !== prev.description
              ? (next.description ?? null)
              : undefined,
          iconName:
            next.icon_name !== prev.icon_name
              ? (next.icon_name ?? null)
              : undefined,
        })
        return { txid: result.txid }
      },

      onDelete: async ({ transaction }) => {
        const { original: prev } = transaction.mutations[0]
        const result = await trpc.spaces.delete.mutate({ id: prev.id })
        return { txid: result.txid }
      },
    })
  )
}

// Per-org spaces collection (org-scoped shape)
type SpacesCollection = ReturnType<typeof createSpacesCollectionFor>
const spacesByOrg = new Map<string, SpacesCollection>()

export function getOrgSpacesCollection(orgId: string): SpacesCollection {
  let col = spacesByOrg.get(orgId)
  if (!col) {
    col = createSpacesCollectionFor(getApiUrl(`/api/spaces?orgId=${orgId}`))
    spacesByOrg.set(orgId, col)
  }
  return col
}

// Local empty collection for stable hooks before orgId is known
export const emptySpacesCollection = createCollection(
  localOnlyCollectionOptions({
    id: "empty-spaces",
    schema: spacesRawSchema,
    getKey: (item) => item.id,
  })
)

// Add near other schemas in this file
const documentsRawSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  space_id: z.string(),
  parent_id: z.string().nullable(),
  slug: z.string(),
  title: z.string(),
  icon_name: z.string().nullable(),
  rank: z.string(),
  type: z.enum(["page", "group", "api"]),
  archived_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type DocumentRow = z.infer<typeof documentsRawSchema>

function createDocumentsCollectionFor(spaceId: string) {
  const url = getApiUrl(`/api/documents?spaceId=${spaceId}`)
  return createCollection(
    electricCollectionOptions({
      id: `documents:space:${spaceId}`,
      shapeOptions: { url, parser: electricParsers },
      schema: documentsRawSchema,
      getKey: (d) => d.id,

      onInsert: async ({ transaction }) => {
        const { modified: row } = transaction.mutations[0]
        const result = await trpc.documents.create.mutate({
          id: row.id,
          spaceId: row.space_id,
          parentId: row.parent_id ?? undefined,
          title: row.title,
          type: row.type,
          iconName: row.icon_name ?? undefined,
        })
        return { txid: result.txid }
      },

      // rename and move will come later
      onUpdate: async ({ transaction }) => {
        const { original: prev, modified: next } = transaction.mutations[0]

        // Build a minimal patch
        const payload: {
          id: string
          title?: string
          iconName?: string | null
          parentId?: string | null
        } = { id: prev.id }

        if (next.title !== prev.title) {
          payload.title = next.title
        }
        if (next.icon_name !== prev.icon_name) {
          payload.iconName = next.icon_name ?? null
        }
        if (next.parent_id !== prev.parent_id) {
          payload.parentId = next.parent_id ?? null
        }

        const result = await trpc.documents.update.mutate(payload)
        return { txid: result.txid }
      },

      onDelete: async ({ transaction }) => {
        const { original: prev } = transaction.mutations[0]
        const result = await trpc.documents.delete.mutate({ id: prev.id })
        return { txid: result.txid }
      },
    })
  )
}

type DocumentsCollection = ReturnType<typeof createDocumentsCollectionFor>
const docsBySpace = new Map<string, DocumentsCollection>()

export function getSpaceDocumentsCollection(
  spaceId: string
): DocumentsCollection {
  let col = docsBySpace.get(spaceId)
  if (!col) {
    col = createDocumentsCollectionFor(spaceId)
    docsBySpace.set(spaceId, col)
  }
  return col
}

// Optional empty collection for stable hooks before spaceId is known
export const emptyDocumentsCollection = createCollection(
  localOnlyCollectionOptions({
    id: "empty-documents",
    schema: documentsRawSchema,
    getKey: (d) => d.id,
  })
)
