import { router, authedProcedure, generateTxId } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { and, eq, inArray, sql } from "drizzle-orm"
import {
  sitesTable,
  siteSpacesTable,
  siteDomainsTable,
  siteBuildsTable,
  spacesTable,
} from "@/db/schema"
import { members as membersTable } from "@/db/auth-schema"
import crypto from "node:crypto"
import { inngest } from "@/inngest"

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

function allocatePrimaryHost(siteNameOrSlug: string) {
  const s = slugify(siteNameOrSlug) || "site"
  const rand = crypto.randomBytes(3).toString("hex")
  return `${s}-${rand}.trydocufy.com`
}

// Basic publish id
function newBuildId() {
  return Date.now().toString(36)
}

export const sitesRouter = router({
  create: authedProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        organizationId: z.string(),
        name: z.string().min(1),
        slug: z.string().min(1).optional(),
        baseUrl: z.string().url(),
        storeId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" })
      await assertOrgRole(ctx.db, userId, input.organizationId, [
        "owner",
        "admin",
      ])

      const id = input.id ?? crypto.randomUUID()
      const slug = input.slug ? slugify(input.slug) : slugify(input.name)

      // org-slug uniqueness
      const exists = await ctx.db
        .select({ id: sitesTable.id })
        .from(sitesTable)
        .where(
          and(
            eq(sitesTable.organizationId, input.organizationId),
            eq(sitesTable.slug, slug)
          )
        )
        .limit(1)
      if (exists.length)
        throw new TRPCError({
          code: "CONFLICT",
          message: "Slug already in use",
        })

      return await ctx.db.transaction(async (tx) => {
        await tx.insert(sitesTable).values({
          id,
          organizationId: input.organizationId,
          name: input.name,
          slug,
          storeId: input.storeId,
          baseUrl: input.baseUrl,
          primaryHost: allocatePrimaryHost(slug),
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
        baseUrl: z.string().url().optional(),
        storeId: z.string().min(1).optional(),
        primaryHost: z.string().optional(),
        // Branding fields
        logoUrlLight: z.string().url().nullable().optional(),
        logoUrlDark: z.string().url().nullable().optional(),
        faviconUrl: z.string().url().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" })

      const current = (
        await ctx.db
          .select({
            id: sitesTable.id,
            organizationId: sitesTable.organizationId,
            slug: sitesTable.slug,
          })
          .from(sitesTable)
          .where(eq(sitesTable.id, input.id))
          .limit(1)
      )[0]
      if (!current) throw new TRPCError({ code: "NOT_FOUND" })
      await assertOrgRole(ctx.db, userId, current.organizationId, [
        "owner",
        "admin",
      ])

      const patch: Partial<typeof sitesTable.$inferInsert> = {}
      if (input.name !== undefined) patch.name = input.name
      if (input.baseUrl !== undefined) patch.baseUrl = input.baseUrl
      if (input.storeId !== undefined) patch.storeId = input.storeId
      if (input.primaryHost !== undefined) patch.primaryHost = input.primaryHost
      if (input.logoUrlLight !== undefined)
        patch.logoUrlLight = input.logoUrlLight
      if (input.logoUrlDark !== undefined) patch.logoUrlDark = input.logoUrlDark
      if (input.faviconUrl !== undefined) patch.faviconUrl = input.faviconUrl

      if (input.slug !== undefined) {
        const next = slugify(input.slug)
        // check conflict inside org
        const conflict = await ctx.db
          .select({ id: sitesTable.id })
          .from(sitesTable)
          .where(
            and(
              eq(sitesTable.organizationId, current.organizationId),
              eq(sitesTable.slug, next)
            )
          )
          .limit(1)
        if (conflict.length && conflict[0]?.id !== current.id) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Slug already in use",
          })
        }
        patch.slug = next
      }

      return await ctx.db.transaction(async (tx) => {
        if (Object.keys(patch).length) {
          await tx
            .update(sitesTable)
            .set(patch)
            .where(eq(sitesTable.id, input.id))
        }
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
          .select({ organizationId: sitesTable.organizationId })
          .from(sitesTable)
          .where(eq(sitesTable.id, input.id))
          .limit(1)
      )[0]
      if (!row) throw new TRPCError({ code: "NOT_FOUND" })
      await assertOrgRole(ctx.db, userId, row.organizationId, [
        "owner",
        "admin",
      ])

      return await ctx.db.transaction(async (tx) => {
        await tx.delete(sitesTable).where(eq(sitesTable.id, input.id))
        const txid = await generateTxId(tx)
        return { txid }
      })
    }),

  setSpaces: authedProcedure
    .input(
      z.object({
        siteId: z.string(),
        items: z.array(
          z.object({
            spaceId: z.string(),
            position: z.number().int().min(0),
            style: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" })

      const s = (
        await ctx.db
          .select({ organizationId: sitesTable.organizationId })
          .from(sitesTable)
          .where(eq(sitesTable.id, input.siteId))
          .limit(1)
      )[0]
      if (!s) throw new TRPCError({ code: "NOT_FOUND" })
      await assertOrgRole(ctx.db, userId, s.organizationId, [
        "owner",
        "admin",
        "member",
      ])

      // Validate spaces belong to same org
      if (input.items.length) {
        const spaceIds = input.items.map((i) => i.spaceId)
        const rows = await ctx.db
          .select({ id: spacesTable.id, orgId: spacesTable.organizationId })
          .from(spacesTable)
          .where(inArray(spacesTable.id, spaceIds))
        const allSameOrg =
          rows.length === spaceIds.length &&
          rows.every((r) => r.orgId === s.organizationId)
        if (!allSameOrg) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Spaces must belong to the same organization",
          })
        }
      }

      return await ctx.db.transaction(async (tx) => {
        await tx
          .delete(siteSpacesTable)
          .where(eq(siteSpacesTable.siteId, input.siteId))
        if (input.items.length) {
          await tx.insert(siteSpacesTable).values(
            input.items.map((it) => ({
              siteId: input.siteId,
              spaceId: it.spaceId,
              position: it.position,
              style: it.style ?? "dropdown",
              organizationId: s.organizationId,
            }))
          )
        }
        const txid = await generateTxId(tx)
        return { txid }
      })
    }),

  siteSpacesCreate: authedProcedure
    .input(
      z.object({
        siteId: z.string(),
        spaceId: z.string(),
        position: z.number().int().min(0),
        style: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" })

      const site = (
        await ctx.db
          .select({ orgId: sitesTable.organizationId })
          .from(sitesTable)
          .where(eq(sitesTable.id, input.siteId))
          .limit(1)
      )[0]
      if (!site) throw new TRPCError({ code: "NOT_FOUND" })
      await assertOrgRole(ctx.db, userId, site.orgId, [
        "owner",
        "admin",
        "member",
      ])

      const space = (
        await ctx.db
          .select({ orgId: spacesTable.organizationId })
          .from(spacesTable)
          .where(eq(spacesTable.id, input.spaceId))
          .limit(1)
      )[0]
      if (!space || space.orgId !== site.orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Space must belong to the same organization",
        })
      }

      return await ctx.db.transaction(async (tx) => {
        await tx.insert(siteSpacesTable).values({
          siteId: input.siteId,
          spaceId: input.spaceId,
          organizationId: site.orgId,
          position: input.position,
          style: input.style ?? "dropdown",
        })
        const txid = await generateTxId(tx)
        return { txid }
      })
    }),

  siteSpacesUpdate: authedProcedure
    .input(
      z.object({
        siteId: z.string(),
        spaceId: z.string(),
        position: z.number().int().min(0).optional(),
        style: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" })

      const site = (
        await ctx.db
          .select({ orgId: sitesTable.organizationId })
          .from(sitesTable)
          .where(eq(sitesTable.id, input.siteId))
          .limit(1)
      )[0]
      if (!site) throw new TRPCError({ code: "NOT_FOUND" })
      await assertOrgRole(ctx.db, userId, site.orgId, [
        "owner",
        "admin",
        "member",
      ])

      const patch: Partial<typeof siteSpacesTable.$inferInsert> = {}
      if (input.position !== undefined) patch.position = input.position
      if (input.style !== undefined) patch.style = input.style

      return await ctx.db.transaction(async (tx) => {
        if (Object.keys(patch).length) {
          await tx
            .update(siteSpacesTable)
            .set(patch)
            .where(
              and(
                eq(siteSpacesTable.siteId, input.siteId),
                eq(siteSpacesTable.spaceId, input.spaceId)
              )
            )
        }
        const txid = await generateTxId(tx)
        return { txid }
      })
    }),

  siteSpacesDelete: authedProcedure
    .input(
      z.object({
        siteId: z.string(),
        spaceId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" })

      const site = (
        await ctx.db
          .select({ orgId: sitesTable.organizationId })
          .from(sitesTable)
          .where(eq(sitesTable.id, input.siteId))
          .limit(1)
      )[0]
      if (!site) throw new TRPCError({ code: "NOT_FOUND" })
      await assertOrgRole(ctx.db, userId, site.orgId, [
        "owner",
        "admin",
        "member",
      ])

      return await ctx.db.transaction(async (tx) => {
        await tx
          .delete(siteSpacesTable)
          .where(
            and(
              eq(siteSpacesTable.siteId, input.siteId),
              eq(siteSpacesTable.spaceId, input.spaceId)
            )
          )
        const txid = await generateTxId(tx)
        return { txid }
      })
    }),

  addDomain: authedProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        siteId: z.string(),
        domain: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" })

      const s = (
        await ctx.db
          .select({ organizationId: sitesTable.organizationId })
          .from(sitesTable)
          .where(eq(sitesTable.id, input.siteId))
          .limit(1)
      )[0]
      if (!s) throw new TRPCError({ code: "NOT_FOUND" })
      await assertOrgRole(ctx.db, userId, s.organizationId, ["owner", "admin"])

      const id = input.id ?? crypto.randomUUID()
      const d = input.domain.trim().toLowerCase()

      const res = await ctx.db.transaction(async (tx) => {
        await tx.insert(siteDomainsTable).values({
          id,
          siteId: input.siteId,
          domain: d,
          verified: false,
          organizationId: s.organizationId,
        })
        return await generateTxId(tx)
      })

      // enqueue connect
      await inngest.send({
        name: "domain/connect",
        data: {
          siteId: input.siteId,
          domain: input.domain.trim().toLowerCase(),
        },
      })
      return { txid: res }
    }),

  removeDomain: authedProcedure
    .input(z.object({ siteId: z.string(), domain: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" })
      const s = (
        await ctx.db
          .select({ organizationId: sitesTable.organizationId })
          .from(sitesTable)
          .where(eq(sitesTable.id, input.siteId))
          .limit(1)
      )[0]
      if (!s) throw new TRPCError({ code: "NOT_FOUND" })
      await assertOrgRole(ctx.db, userId, s.organizationId, ["owner", "admin"])

      return await ctx.db.transaction(async (tx) => {
        await tx
          .delete(siteDomainsTable)
          .where(
            and(
              eq(siteDomainsTable.siteId, input.siteId),
              eq(siteDomainsTable.domain, input.domain)
            )
          )
        // TODO: best effort remove from Vercel via Inngest
        await inngest.send({
          name: "domain/remove",
          data: { domain: input.domain.trim().toLowerCase() },
        })
        const txid = await generateTxId(tx)
        return { txid }
      })
    }),

  publish: authedProcedure
    .input(z.object({ siteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" })

      const site = (
        await ctx.db
          .select({
            id: sitesTable.id,
            orgId: sitesTable.organizationId,
          })
          .from(sitesTable)
          .where(eq(sitesTable.id, input.siteId))
          .limit(1)
      )[0]
      if (!site) throw new TRPCError({ code: "NOT_FOUND" })
      await assertOrgRole(ctx.db, userId, site.orgId, ["owner", "admin"])

      // Snapshot selected space ids and create a build
      const selected = await ctx.db
        .select({ spaceId: siteSpacesTable.spaceId })
        .from(siteSpacesTable)
        .where(eq(siteSpacesTable.siteId, input.siteId))
        .orderBy(sql`${siteSpacesTable.position} asc`)

      const buildId = newBuildId()
      const snapshot = selected.map((r) => r.spaceId)

      return await ctx.db.transaction(async (tx) => {
        // mark build queued
        await tx.insert(siteBuildsTable).values({
          siteId: input.siteId,
          buildId,
          status: "queued",
          operation: "publish",
          actorUserId: userId,
          selectedSpaceIdsSnapshot: snapshot,
          itemsTotal: 0,
          itemsDone: 0,
          pagesWritten: 0,
          bytesWritten: 0,
          organizationId: site.orgId,
        })

        // enqueue Inngest job site.publish with { siteId, buildId, actorUserId }
        await inngest.send({
          name: "site/publish",
          data: { siteId: input.siteId, buildId, actorUserId: userId },
        })

        const txid = await generateTxId(tx)
        return { txid, buildId }
      })
    }),

  revert: authedProcedure
    .input(z.object({ siteId: z.string(), targetBuildId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" })

      const site = (
        await ctx.db
          .select({ orgId: sitesTable.organizationId })
          .from(sitesTable)
          .where(eq(sitesTable.id, input.siteId))
          .limit(1)
      )[0]
      if (!site) throw new TRPCError({ code: "NOT_FOUND" })
      await assertOrgRole(ctx.db, userId, site.orgId, ["owner", "admin"])

      const buildId = newBuildId()

      return await ctx.db.transaction(async (tx) => {
        await tx.insert(siteBuildsTable).values({
          siteId: input.siteId,
          buildId,
          status: "queued",
          operation: "revert",
          actorUserId: userId,
          selectedSpaceIdsSnapshot: [],
          targetBuildId: input.targetBuildId,
          organizationId: site.orgId,
          itemsTotal: 0,
          itemsDone: 0,
          pagesWritten: 0,
          bytesWritten: 0,
        })

        // enqueue Inngest job site.revert with { siteId, buildId, targetBuildId }
        await inngest.send({
          name: "site/revert",
          data: {
            siteId: input.siteId,
            buildId,
            targetBuildId: input.targetBuildId,
          },
        })

        const txid = await generateTxId(tx)
        return { txid, buildId }
      })
    }),

  verifyDomain: authedProcedure
    .input(z.object({ domain: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" })

      const domain = input.domain.trim().toLowerCase()

      // Find the domain and its owning org
      const row = (
        await ctx.db
          .select({
            siteId: siteDomainsTable.siteId,
            orgId: sitesTable.organizationId,
          })
          .from(siteDomainsTable)
          .innerJoin(sitesTable, eq(siteDomainsTable.siteId, sitesTable.id))
          .where(eq(siteDomainsTable.domain, domain))
          .limit(1)
      )[0]
      if (!row)
        throw new TRPCError({ code: "NOT_FOUND", message: "Domain not found" })

      await assertOrgRole(ctx.db, userId, row.orgId, ["owner", "admin"])

      // Enqueue Inngest domain verify job (your Inngest function will update DB)
      await inngest.send({ name: "domain/verify", data: { domain } })
      return { enqueued: true }
    }),
})
