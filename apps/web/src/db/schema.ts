import { createSchemaFactory } from "drizzle-zod"
import { z } from "zod"
export * from "./auth-schema"
import { users, organizations, members, invitations } from "./auth-schema"
import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core"

const { createSelectSchema } = createSchemaFactory({ zodInstance: z })

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

export const selectUsersSchema = createSelectSchema(users)
export const selectOrganizationsSchema = createSelectSchema(organizations)
export const selectMembersSchema = createSelectSchema(members)
export const selectInvitationsSchema = createSelectSchema(invitations)
export const selectOrgUserProfilesSchema = createSelectSchema(orgUserProfiles)
