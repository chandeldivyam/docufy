import { router, authedProcedure, generateTxId } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { and, eq, isNull, ne } from "drizzle-orm"
import { documentsTable, spacesTable } from "@/db/schema"
import { members as membersTable } from "@/db/auth-schema"
import crypto from "node:crypto"

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 120)
}

async function assertOrgRole(
  db: typeof import("@/db/connection").db extends infer T ? T : never,
  userId: string,
  orgId: string,
  roles: Array<"owner" | "admin" | "member">
) {
  const rows = await db
    .select({ role: membersTable.role })
    .from(membersTable)
    .where(
      and(
        eq(membersTable.organizationId, orgId),
        eq(membersTable.userId, userId)
      )
    )
    .limit(1)
  const role = rows[0]?.role
  if (
    !role ||
    typeof role !== "string" ||
    !roles.includes(role as "owner" | "admin" | "member")
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Insufficient permissions",
    })
  }
}

// 10-char, left-padded base36 timestamp so lexicographic order matches creation time
function newTailRank() {
  const w = 10
  return Date.now().toString(36).padStart(w, "0")
}

export const documentsRouter = router({
  create: authedProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        spaceId: z.string(),
        parentId: z.string().optional(),
        title: z.string().min(1),
        type: z.enum(["page", "group", "api"]).optional(),
        iconName: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" })

      // Load space to derive org and validate membership
      const space = (
        await ctx.db
          .select({ organizationId: spacesTable.organizationId })
          .from(spacesTable)
          .where(eq(spacesTable.id, input.spaceId))
          .limit(1)
      )[0]
      if (!space)
        throw new TRPCError({ code: "NOT_FOUND", message: "Space not found" })

      await assertOrgRole(ctx.db, userId, space.organizationId, [
        "owner",
        "admin",
        "member",
      ])

      const id = input.id ?? crypto.randomUUID()
      const type = input.type ?? "page"
      const parentId = input.parentId ?? null

      // Slug unique among siblings (space_id, parent_id)
      const base = slugify(input.title) || "untitled"
      let slug = base
      let attempt = 0
      while (true) {
        const siblingWhere =
          parentId === null
            ? and(
                eq(documentsTable.spaceId, input.spaceId),
                isNull(documentsTable.parentId),
                eq(documentsTable.slug, slug)
              )
            : and(
                eq(documentsTable.spaceId, input.spaceId),
                eq(documentsTable.parentId, parentId),
                eq(documentsTable.slug, slug)
              )

        const conflict = await ctx.db
          .select({ id: documentsTable.id })
          .from(documentsTable)
          .where(siblingWhere)
          .limit(1)
        if (!conflict.length) break
        attempt++
        slug = `${base}-${attempt.toString(36)}`
      }

      const rank = newTailRank()

      return await ctx.db.transaction(async (tx) => {
        await tx.insert(documentsTable).values({
          id,
          organizationId: space.organizationId,
          spaceId: input.spaceId,
          parentId,
          slug,
          title: input.title,
          iconName: input.iconName ?? null,
          rank,
          type,
        })

        const txid = await generateTxId(tx)
        return { txid }
      })
    }),

  delete: authedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" })

      const doc = (
        await ctx.db
          .select({
            id: documentsTable.id,
            spaceId: documentsTable.spaceId,
            orgId: documentsTable.organizationId,
            type: documentsTable.type,
          })
          .from(documentsTable)
          .where(eq(documentsTable.id, input.id))
          .limit(1)
      )[0]
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" })

      // Keep delete to admins/owners for now
      await assertOrgRole(ctx.db, userId, doc.orgId, ["owner", "admin"])

      return await ctx.db.transaction(async (tx) => {
        await tx.delete(documentsTable).where(eq(documentsTable.id, input.id))
        const txid = await generateTxId(tx)
        return { txid }
      })
    }),
  update: authedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        iconName: z.string().nullable().optional(),
        parentId: z.string().nullable().optional(), // not required by UX now, but future-proof
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" })

      const current = (
        await ctx.db
          .select({
            id: documentsTable.id,
            orgId: documentsTable.organizationId,
            spaceId: documentsTable.spaceId,
            parentId: documentsTable.parentId,
            slug: documentsTable.slug,
            title: documentsTable.title,
            type: documentsTable.type,
          })
          .from(documentsTable)
          .where(eq(documentsTable.id, input.id))
          .limit(1)
      )[0]

      if (!current) throw new TRPCError({ code: "NOT_FOUND" })

      await assertOrgRole(ctx.db, userId, current.orgId, [
        "owner",
        "admin",
        "member",
      ])

      // Build patch
      const patch: Partial<typeof documentsTable.$inferInsert> = {}
      const finalParentId =
        input.parentId !== undefined ? input.parentId : current.parentId

      if (input.title !== undefined) {
        patch.title = input.title
        // regenerate slug unique among siblings (space_id + parent_id)
        const base = slugify(input.title) || "untitled"
        let slug = base
        let attempt = 0

        // Sibling equals: same space AND same parent (null-safe)
        while (true) {
          const siblingWhere =
            finalParentId === null
              ? and(
                  eq(documentsTable.spaceId, current.spaceId),
                  isNull(documentsTable.parentId),
                  eq(documentsTable.slug, slug),
                  ne(documentsTable.id, current.id)
                )
              : and(
                  eq(documentsTable.spaceId, current.spaceId),
                  eq(documentsTable.parentId, finalParentId),
                  eq(documentsTable.slug, slug),
                  ne(documentsTable.id, current.id)
                )
          const conflict = await ctx.db
            .select({ id: documentsTable.id })
            .from(documentsTable)
            .where(siblingWhere)
            .limit(1)
          if (!conflict.length) break
          attempt++
          slug = `${base}-${attempt.toString(36)}`
        }
        patch.slug = slug
      }

      if (input.iconName !== undefined) {
        patch.iconName = input.iconName ?? null
      }

      // Optional move within same space - not exposed in UI yet
      if (input.parentId !== undefined) {
        patch.parentId = input.parentId ?? null
      }

      return await ctx.db.transaction(async (tx) => {
        if (Object.keys(patch).length === 0) {
          const txid = await generateTxId(tx)
          return { txid }
        }

        await tx
          .update(documentsTable)
          .set(patch)
          .where(eq(documentsTable.id, current.id))

        const txid = await generateTxId(tx)
        return { txid }
      })
    }),
})
