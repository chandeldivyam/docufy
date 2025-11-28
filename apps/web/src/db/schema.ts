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
  jsonb,
  integer,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

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
      .$type<"page" | "group" | "api" | "api_spec" | "api_tag">()
      .default("page")
      .notNull(),
    apiSpecBlobKey: text("api_spec_blob_key"),
    apiPath: text("api_path"),
    apiMethod: text("api_method"),
    archivedAt: timestamp("archived_at"),
    specSourceId: text("spec_source_id"),
    apiTag: text("api_tag"),
    managedBySpec: boolean("managed_by_spec").default(false).notNull(),
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
    specSourceFk: foreignKey({
      name: "documents_spec_source_id_documents_id_fk", // optional but nice
      columns: [t.specSourceId],
      foreignColumns: [t.id],
    }).onDelete("set null"),
    apiUniqueIdx: uniqueIndex("documents_api_path_method_source_unique")
      .on(t.apiPath, t.apiMethod, t.specSourceId)
      .where(
        sql`${t.apiPath} IS NOT NULL AND ${t.apiMethod} IS NOT NULL AND ${t.specSourceId} IS NOT NULL`
      ),
    apiTagUniqueIdx: uniqueIndex("documents_api_tag_source_unique") // NEW
      .on(t.apiTag, t.specSourceId)
      .where(sql`${t.apiTag} IS NOT NULL AND ${t.specSourceId} IS NOT NULL`),
  })
)

export const githubInstallations = pgTable("github_installations", {
  id: text("id").primaryKey(), // GitHub installation_id
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  accountLogin: text("account_login").notNull(),
  accountType: text("account_type").notNull(), // "User" | "Organization"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export const githubRepositories = pgTable("github_repositories", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  installationId: text("installation_id")
    .notNull()
    .references(() => githubInstallations.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(), // owner/name
  defaultBranch: text("default_branch").notNull(),
  private: boolean("private").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

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
    apiTag: z.string().optional(),
    managedBySpec: z.boolean().optional(),
    apiSpecBlobKey: z.string().optional(),
    apiPath: z.string().optional(),
    apiMethod: z.string().optional(),
    specSourceId: z.string().optional(),
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
    layout: text("layout").default("sidebar-dropdown").notNull(),
    // a jsonb column to store the array of button (with slug, href "could be external link or internal route", icon name, label, rank, type (sidebar_buttom, sidebar_top, topbar_left, topbar_right))
    buttons: jsonb("buttons")
      .$type<
        Array<{
          id: string
          label: string
          href: string
          iconName?: string | null
          slug?: string | null
          position:
            | "sidebar_top"
            | "sidebar_bottom"
            | "topbar_left"
            | "topbar_right"
          rank: number
          target?: "_self" | "_blank"
        }>
      >()
      .notNull()
      .default(sql`'[]'::jsonb`),
    contentSource: text("content_source")
      .$type<"studio" | "github">()
      .default("studio")
      .notNull(),
    githubInstallationId: text("github_installation_id").references(
      () => githubInstallations.id,
      { onDelete: "set null" }
    ),
    githubRepoFullName: text("github_repo_full_name"),
    githubBranch: text("github_branch"),
    githubConfigPath: text("github_config_path"),
    githubConfigStatus: text("github_config_status").default("idle").notNull(),
    githubConfigSyncedAt: timestamp("github_config_synced_at"),
    githubConfigSha: text("github_config_sha"),
    githubConfigVersion: integer("github_config_version").default(1).notNull(),
    githubConfigError: text("github_config_error"),
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
    error: text("error"),
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
    sourceCommitSha: text("source_commit_sha"),
  },
  (t) => ({
    buildUnique: uniqueIndex("site_builds_build_unique").on(t.buildId),
    siteIdx: index("site_builds_site_idx").on(t.siteId),
  })
)

export const siteRepoSyncsTable = pgTable(
  "site_repo_syncs",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => sitesTable.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    status: text("status").notNull(), // idle|queued|running|success|failed
    error: text("error"),
    configSha: text("config_sha"),
    commitSha: text("commit_sha"),
    branch: text("branch"),
    configPath: text("config_path"),
    triggeredBy: text("triggered_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    finishedAt: timestamp("finished_at"),
  },
  (t) => ({
    siteIdx: index("site_repo_syncs_site_idx").on(t.siteId),
    orgIdx: index("site_repo_syncs_org_idx").on(t.organizationId),
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

export const siteGithubDocsTable = pgTable(
  "site_github_docs",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => sitesTable.id, { onDelete: "cascade" }),
    branch: text("branch").notNull(),
    path: text("path").notNull(),
    sha: text("sha").notNull(),
    contentBlobHash: text("content_blob_hash").notNull(),
    title: text("title").notNull(),
    headings: jsonb("headings").$type<string[]>().notNull().default([]),
    plain: text("plain").notNull().default(""),
    size: integer("size").notNull(),
    kind: text("kind")
      .$type<"page" | "group" | "api" | "api_spec" | "api_tag">()
      .default("page"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => ({
    siteBranchPathIdx: uniqueIndex("site_github_docs_site_branch_path_idx").on(
      t.siteId,
      t.branch,
      t.path
    ),
  })
)

export const siteGithubAssetsTable = pgTable(
  "site_github_assets",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => sitesTable.id, { onDelete: "cascade" }),
    branch: text("branch").notNull(),
    path: text("path").notNull(),
    sha: text("sha").notNull(),
    blobKey: text("blob_key").notNull(),
    url: text("url").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => ({
    siteBranchPathIdx: uniqueIndex(
      "site_github_assets_site_branch_path_idx"
    ).on(t.siteId, t.branch, t.path),
  })
)

// Zod schemas
export const selectSitesSchema = createSelectSchema(sitesTable)
export const selectSiteSpacesSchema = createSelectSchema(siteSpacesTable)
export const selectSiteDomainsSchema = createSelectSchema(siteDomainsTable)
export const selectSiteBuildsSchema = createSelectSchema(siteBuildsTable)
export const selectSiteRepoSyncsSchema = createSelectSchema(siteRepoSyncsTable)
export const selectSiteContentBlobsSchema = createSelectSchema(
  siteContentBlobsTable
)
export const selectSiteGithubDocsSchema =
  createSelectSchema(siteGithubDocsTable)
export const selectSiteGithubAssetsSchema = createSelectSchema(
  siteGithubAssetsTable
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
    layout: z.enum(["sidebar-dropdown", "tabs"]).optional(),
    buttons: z
      .array(
        z.object({
          id: z.string(),
          label: z.string().min(1),
          href: z.string().min(1),
          iconName: z.string().nullable().optional(),
          slug: z.string().nullable().optional(),
          position: z.enum([
            "sidebar_top",
            "sidebar_bottom",
            "topbar_left",
            "topbar_right",
          ]),
          rank: z.number().int(),
          target: z.enum(["_self", "_blank"]).optional(),
        })
      )
      .optional(),
  })

export const siteThemesTable = pgTable(
  "site_themes",
  {
    siteId: text("site_id")
      .notNull()
      .references(() => sitesTable.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    version: integer("version").default(1).notNull(),
    // minimal, composable structure
    lightTokens: jsonb("light_tokens")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    darkTokens: jsonb("dark_tokens")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    vars: jsonb("vars").$type<Record<string, string>>().notNull().default({}),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.siteId] }),
    siteIdx: index("site_themes_site_idx").on(t.siteId),
  })
)

export const selectSiteThemesSchema = createSelectSchema(siteThemesTable)
export const createSiteThemeSchema = createInsertSchema(siteThemesTable).omit({
  updatedAt: true,
})

export const siteSearchKeysTable = pgTable(
  "site_search_keys",
  {
    siteId: text("site_id")
      .notNull()
      .references(() => sitesTable.id, { onDelete: "cascade" }),
    keyValue: text("key_value").notNull(), // The parent search-only key (value as returned at creation)
    expiresAt: timestamp("expires_at"), // Optional TTL if you rotate periodically
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.siteId] }),
  })
)

export const selectSiteSearchKeysSchema =
  createSelectSchema(siteSearchKeysTable)
