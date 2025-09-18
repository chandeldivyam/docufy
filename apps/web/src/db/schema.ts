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
      .$type<"page" | "group" | "api">()
      .default("page")
      .notNull(),
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
    type: z.enum(["page", "group", "api"]).optional(),
  })
