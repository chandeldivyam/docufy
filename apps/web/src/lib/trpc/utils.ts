import { members as membersTable } from "@/db/auth-schema"
import { and, eq } from "drizzle-orm"
import { TRPCError } from "@trpc/server"

export async function assertOrgRole(
  db: typeof import("@/db/connection").db extends infer T ? T : never,
  userId: string,
  orgId: string,
  roles: Array<"owner" | "admin" | "member">
) {
  const row = (
    await db
      .select({ role: membersTable.role })
      .from(membersTable)
      .where(
        and(
          eq(membersTable.organizationId, orgId),
          eq(membersTable.userId, userId)
        )
      )
      .limit(1)
  )[0]
  const role = row?.role
  if (!role || !roles.includes(role as "owner" | "admin" | "member")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Insufficient permissions",
    })
  }
}
