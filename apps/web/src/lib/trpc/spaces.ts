import { router, authedProcedure } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { eq, and } from "drizzle-orm"
import { spacesTable, createSpaceSchema } from "@/db/schema"
import { members as membersTable } from "@/db/auth-schema"
import { generateTxId } from "@/lib/trpc"
import crypto from "node:crypto"

const slugify = (input: string) =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80)

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

export const spacesRouter = router({
  create: authedProcedure
    .input(createSpaceSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" })

      await assertOrgRole(ctx.db, userId, input.organizationId, [
        "owner",
        "admin",
        "member",
      ])

      const finalSlug = input.slug ? slugify(input.slug) : slugify(input.name)
      const id = input.id ?? crypto.randomUUID()

      return await ctx.db.transaction(async (tx) => {
        const existing = await tx
          .select({ id: spacesTable.id })
          .from(spacesTable)
          .where(
            and(
              eq(spacesTable.organizationId, input.organizationId),
              eq(spacesTable.slug, finalSlug)
            )
          )
          .limit(1)

        if (existing.length) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Space with this slug already exists",
          })
        }

        await tx.insert(spacesTable).values({
          id,
          organizationId: input.organizationId,
          name: input.name,
          slug: finalSlug,
          description: input.description,
          iconName: input.iconName,
        })

        const txid = await generateTxId(tx)
        return { txid }
      })
    }),

  update: authedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        slug: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        iconName: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" })

      const row = (
        await ctx.db
          .select({
            id: spacesTable.id,
            organizationId: spacesTable.organizationId,
            slug: spacesTable.slug,
          })
          .from(spacesTable)
          .where(eq(spacesTable.id, input.id))
          .limit(1)
      )[0]
      if (!row) throw new TRPCError({ code: "NOT_FOUND" })

      await assertOrgRole(ctx.db, userId, row.organizationId, [
        "owner",
        "admin",
        "member",
      ])

      const patch: Partial<typeof spacesTable.$inferInsert> = {}
      if (input.name !== undefined) patch.name = input.name
      if (input.slug !== undefined) patch.slug = slugify(input.slug)
      if (input.description !== undefined)
        patch.description = input.description ?? null
      if (input.iconName !== undefined) patch.iconName = input.iconName ?? null

      return await ctx.db.transaction(async (tx) => {
        if (patch.slug) {
          const conflict = await tx
            .select({ id: spacesTable.id })
            .from(spacesTable)
            .where(
              and(
                eq(spacesTable.organizationId, row.organizationId),
                eq(spacesTable.slug, patch.slug)
              )
            )
            .limit(1)
          if (conflict.length && conflict[0] && conflict[0].id !== input.id) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "Slug already exists in this organization",
            })
          }
        }

        await tx
          .update(spacesTable)
          .set(patch)
          .where(eq(spacesTable.id, input.id))
        const txid = await generateTxId(tx)
        return { txid }
      })
    }),

  delete: authedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" })

      const row = (
        await ctx.db
          .select({
            id: spacesTable.id,
            organizationId: spacesTable.organizationId,
          })
          .from(spacesTable)
          .where(eq(spacesTable.id, input.id))
          .limit(1)
      )[0]
      if (!row) throw new TRPCError({ code: "NOT_FOUND" })

      await assertOrgRole(ctx.db, userId, row.organizationId, [
        "owner",
        "admin",
      ])

      return await ctx.db.transaction(async (tx) => {
        await tx.delete(spacesTable).where(eq(spacesTable.id, input.id))
        const txid = await generateTxId(tx)
        return { txid }
      })
    }),
})
