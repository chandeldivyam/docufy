import { createSchemaFactory } from "drizzle-zod"
import { z } from "zod"
export * from "./auth-schema"
import { users, organizations, members, invitations } from "./auth-schema"
import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core"

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
