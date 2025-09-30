import { createSchemaFactory } from "drizzle-zod"
import { z } from "zod"
export * from "./auth-schema"
import { users, organizations, members, invitations } from "./auth-schema"
import {
  pgTable,
  text,
  timestamp,
  primaryKey,
  foreignKey,
  uniqueIndex,
  index,
  bigserial,
  boolean,
} from "drizzle-orm/pg-core"

const { createSelectSchema, createInsertSchema } = createSchemaFactory({
  zodInstance: z,
})

export const orgUserProfiles = pgTable(
  "org_user_profiles",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(),
    name: text("name"),
    email: text("email"),
    image: text("image"),
    orgName: text("org_name"),
    orgSlug: text("org_slug"),
    orgLogo: text("org_logo"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.organizationId, t.userId] }) })
)

export const spacesTable = pgTable("spaces", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  iconName: text("icon_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
})

export const documentsTable = pgTable(
  "documents",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    spaceId: text("space_id")
      .notNull()
      .references(() => spacesTable.id, { onDelete: "cascade" }),
    // NOTE: no .references() here to avoid self-ref during init
    parentId: text("parent_id"),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    iconName: text("icon_name"),
    rank: text("rank").notNull(),
    // Give 'type' a precise TS type and default
    type: text("type")
      .$type<"page" | "group" | "api" | "api_spec">()
      .default("page")
      .notNull(),
    apiSpecBlobKey: text("api_spec_blob_key"),
    apiPath: text("api_path"),
    apiMethod: text("api_method"),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (t) => ({
    // Define the self-FK here (safe, no circular init)
    parentFk: foreignKey({
      name: "documents_parent_id_documents_id_fk", // optional but nice
      columns: [t.parentId],
      foreignColumns: [t.id],
    }).onDelete("set null"),
  })
)

export const selectUsersSchema = createSelectSchema(users)
export const selectOrganizationsSchema = createSelectSchema(organizations)
export const selectMembersSchema = createSelectSchema(members)
export const selectInvitationsSchema = createSelectSchema(invitations)
export const selectOrgUserProfilesSchema = createSelectSchema(orgUserProfiles)
export const selectSpacesSchema = createSelectSchema(spacesTable)
export const createSpaceSchema = createInsertSchema(spacesTable)
  .omit({
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    id: z.string().uuid().optional(),
  })

export const selectDocumentsSchema = createSelectSchema(documentsTable)
export const createDocumentSchema = createInsertSchema(documentsTable)
  .omit({
    organizationId: true,
    slug: true,
    rank: true,
    archivedAt: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    id: z.string().uuid().optional(),
    parentId: z.string().optional(),
    iconName: z.string().nullable().optional(),
    title: z.string().min(1),
    type: z.enum(["page", "group", "api", "api_spec"]).optional(),
    apiSpecBlobKey: z.string().optional(),
    apiPath: z.string().optional(),
    apiMethod: z.string().optional(),
  })

export const sitesTable = pgTable(
  "sites",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    storeId: text("store_id").notNull(),
    baseUrl: text("base_url").notNull(),
    primaryHost: text("primary_host"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    lastBuildId: text("last_build_id"),
    lastPublishedAt: timestamp("last_published_at"),
    logoUrlLight: text("logo_url_light"),
    logoUrlDark: text("logo_url_dark"),
    faviconUrl: text("favicon_url"),
  },
  (t) => ({
    orgSlugUnique: uniqueIndex("sites_org_slug_unique").on(
      t.organizationId,
      t.slug
    ),
  })
)

export const siteSpacesTable = pgTable(
  "site_spaces",
  {
    siteId: text("site_id")
      .notNull()
      .references(() => sitesTable.id, { onDelete: "cascade" }),
    spaceId: text("space_id")
      .notNull()
      .references(() => spacesTable.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    position: text("position").$type<number>().notNull(),
    style: text("style").default("dropdown").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.siteId, t.spaceId] }),
  })
)

export const siteDomainsTable = pgTable(
  "site_domains",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => sitesTable.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    verified: boolean("verified").default(false).notNull(),
    lastCheckedAt: timestamp("last_checked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => ({
    domainUnique: uniqueIndex("site_domains_domain_unique").on(t.domain),
    siteDomainUnique: uniqueIndex("site_domains_site_domain_unique").on(
      t.siteId,
      t.domain
    ),
  })
)

export const siteBuildsTable = pgTable(
  "site_builds",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => sitesTable.id, { onDelete: "cascade" }),
    buildId: text("build_id").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    status: text("status").notNull(), // queued|running|success|failed
    operation: text("operation").notNull(), // publish|revert
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    selectedSpaceIdsSnapshot: text("selected_space_ids_snapshot")
      .$type<string[]>()
      .notNull(),
    targetBuildId: text("target_build_id"),
    itemsTotal: text("items_total").$type<number>().default(0).notNull(),
    itemsDone: text("items_done").$type<number>().default(0).notNull(),
    pagesWritten: text("pages_written").$type<number>().default(0).notNull(),
    bytesWritten: text("bytes_written").$type<number>().default(0).notNull(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    finishedAt: timestamp("finished_at"),
  },
  (t) => ({
    buildUnique: uniqueIndex("site_builds_build_unique").on(t.buildId),
    siteIdx: index("site_builds_site_idx").on(t.siteId),
  })
)

export const siteContentBlobsTable = pgTable(
  "site_content_blobs",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    hash: text("hash").notNull(),
    key: text("key").notNull(),
    size: text("size").$type<number>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastUsedAt: timestamp("last_used_at").defaultNow().notNull(),
    refCount: text("ref_count").$type<number>().default(1).notNull(),
  },
  (t) => ({
    orgHashUnique: uniqueIndex("site_content_blobs_org_hash_unique").on(
      t.organizationId,
      t.hash
    ),
  })
)

// Zod schemas
export const selectSitesSchema = createSelectSchema(sitesTable)
export const selectSiteSpacesSchema = createSelectSchema(siteSpacesTable)
export const selectSiteDomainsSchema = createSelectSchema(siteDomainsTable)
export const selectSiteBuildsSchema = createSelectSchema(siteBuildsTable)
export const selectSiteContentBlobsSchema = createSelectSchema(
  siteContentBlobsTable
)

export const createSiteSchema = createInsertSchema(sitesTable)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    lastBuildId: true,
    lastPublishedAt: true,
  })
  .extend({
    id: z.string().uuid().optional(),
    slug: z.string().min(1).optional(),
  })
