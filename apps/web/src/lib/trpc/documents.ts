import { router, authedProcedure, generateTxId } from "@/lib/trpc"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { documentsTable, spacesTable } from "@/db/schema"
import { members as membersTable } from "@/db/auth-schema"
import crypto from "node:crypto"
import { sql } from "drizzle-orm/sql"

import * as YAML from "yaml"
import { dereference } from "@scalar/openapi-parser" // add on server
import { and, eq, isNull, ne, inArray } from "drizzle-orm"

const METHODS = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
  "trace",
] as const
const METHOD_ORDER = new Map(METHODS.map((m, i) => [m, i]))

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

async function isInsideManagedSpecSubtree(
  db: typeof import("@/db/connection").db extends infer T ? T : never,
  docId: string
) {
  const { sql } = await import("drizzle-orm")
  const res = await db.execute(sql`
    with recursive ancestors as (
      select d.id, d.parent_id, d.type, d.managed_by_spec
        from ${documentsTable} d where d.id = ${docId}
      union all
      select p.id, p.parent_id, p.type, p.managed_by_spec
        from ${documentsTable} p
        join ancestors a on p.id = a.parent_id
    )
    select 1 as hit from ancestors
      where type = 'api_spec' or managed_by_spec = true
      limit 1
  `)
  return Array.isArray(res.rows) && res.rows.length > 0
}

export const documentsRouter = router({
  create: authedProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        spaceId: z.string(),
        parentId: z.string().optional(),
        title: z.string().min(1),
        type: z
          .enum(["page", "group", "api", "api_spec", "api_tag"])
          .optional(),
        iconName: z.string().nullable().optional(),
        apiSpecBlobKey: z.string().nullable().optional(),
        apiPath: z.string().nullable().optional(),
        apiMethod: z.string().nullable().optional(),
        managedBySpec: z.boolean().optional(),
        apiTag: z.string().optional(),
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

      if (input.parentId) {
        const locked = await isInsideManagedSpecSubtree(ctx.db, input.parentId)
        if (locked) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This section is auto-generated from an API spec.",
          })
        }
      }

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
          apiSpecBlobKey: input.apiSpecBlobKey ?? null,
          apiPath: input.apiPath ?? null,
          apiMethod: input.apiMethod ?? null,
          specSourceId: input.apiPath ? parentId : null,
          managedBySpec: input.managedBySpec ?? false,
          apiTag: input.apiTag ?? null,
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

      await assertOrgRole(ctx.db, userId, doc.orgId, ["owner", "admin"])
      if (doc.type !== "api_spec") {
        const locked = await isInsideManagedSpecSubtree(ctx.db, doc.id)
        if (locked) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Cannot delete auto-generated API items individually. Remove them via the API spec or delete the spec root.",
          })
        }
      }

      return await ctx.db.transaction(async (tx) => {
        // Collect target + all descendants and delete in one go
        await tx.execute(sql`
          with recursive to_delete as (
            select d.id from ${documentsTable} d where d.id = ${input.id}
            union all
            select c.id
            from ${documentsTable} c
            join to_delete td on c.parent_id = td.id
          )
          delete from ${documentsTable}
          where id in (select id from to_delete)
        `)

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
        rank: z.string().min(1).optional(),
        apiSpecBlobKey: z.string().nullable().optional(),
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
            apiSpecBlobKey: documentsTable.apiSpecBlobKey,
          })
          .from(documentsTable)
          .where(eq(documentsTable.id, input.id))
          .limit(1)
      )[0]

      if (!current) throw new TRPCError({ code: "NOT_FOUND" })

      const isManaged =
        current.type !== "api_spec"
          ? await isInsideManagedSpecSubtree(ctx.db, current.id)
          : false

      if (isManaged) {
        // Allow no-op updates; allow only API spec blob key change on the spec root (handled elsewhere)
        if (input.apiSpecBlobKey !== undefined && current.type === "api_spec") {
          // ok allow update of blob on spec root
        } else {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Auto-generated API docs are read-only. Edit the OpenAPI spec instead.",
          })
        }
      }

      await assertOrgRole(ctx.db, userId, current.orgId, [
        "owner",
        "admin",
        "member",
      ])

      // Build patch
      const patch: Partial<typeof documentsTable.$inferInsert> = {}
      const finalParentId =
        input.parentId !== undefined ? input.parentId : current.parentId
      const parentChanged =
        input.parentId !== undefined && input.parentId !== current.parentId

      // Validate parent change early
      if (input.parentId !== undefined) {
        const newParentId = input.parentId

        // 1) self-parent is forbidden
        if (newParentId === current.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot set a document as its own parent",
          })
        }

        if (newParentId !== null) {
          // 2) Parent must exist and be in the same space and org
          const parent = (
            await ctx.db
              .select({
                id: documentsTable.id,
                orgId: documentsTable.organizationId,
                spaceId: documentsTable.spaceId,
              })
              .from(documentsTable)
              .where(eq(documentsTable.id, newParentId))
              .limit(1)
          )[0]
          if (!parent) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Parent not found",
            })
          }
          if (
            parent.orgId !== current.orgId ||
            parent.spaceId !== current.spaceId
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Parent must belong to the same space",
            })
          }

          // 3) No cycles: parent cannot be any descendant of current
          // Use a recursive CTE to find descendants of current.id, and ensure newParentId is not in that set.
          const { sql } = await import("drizzle-orm")
          const res = await ctx.db.execute(sql`
            with recursive descendants(id) as (
              select d.id from ${documentsTable} d where d.parent_id = ${current.id}
              union all
              select d2.id from ${documentsTable} d2
              join descendants on d2.parent_id = descendants.id
            )
            select 1 as hit from descendants where id = ${newParentId} limit 1
          `)
          const hit = Array.isArray(res.rows) && res.rows.length > 0
          if (hit) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Cannot move a document inside its own descendant",
            })
          }
        }
      }

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

      // Parent move without title change: ensure current slug remains unique in new sibling set.
      if (input.title === undefined && parentChanged) {
        const base = current.slug || slugify(current.title) || "untitled"
        let slug = base
        let attempt = 0
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

      if (input.rank !== undefined) {
        patch.rank = input.rank
      }

      if (input.apiSpecBlobKey !== undefined) {
        patch.apiSpecBlobKey = input.apiSpecBlobKey ?? null
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
        // TODO: start the inngest job to generate the API spec
        return { txid }
      })
    }),

  importOpenApi: authedProcedure
    .input(
      z.object({
        parentId: z.string(),
        spaceId: z.string(),
        specText: z.string().optional(),
        blobUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" })

      // 1) validate parent
      const parent = (
        await ctx.db
          .select({
            id: documentsTable.id,
            orgId: documentsTable.organizationId,
            spaceId: documentsTable.spaceId,
            type: documentsTable.type,
            apiSpecBlobKey: documentsTable.apiSpecBlobKey,
          })
          .from(documentsTable)
          .where(eq(documentsTable.id, input.parentId))
          .limit(1)
      )[0]
      if (
        !parent ||
        parent.type !== "api_spec" ||
        parent.spaceId !== input.spaceId
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid API spec parent",
        })
      }
      await assertOrgRole(ctx.db, userId, parent.orgId, [
        "owner",
        "admin",
        "member",
      ])

      // 2) load + parse
      const raw =
        input.specText ??
        (parent.apiSpecBlobKey
          ? await fetch(parent.apiSpecBlobKey).then((r) => r.text())
          : null)
      if (!raw)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No spec provided",
        })
      let root
      try {
        root = raw.trim().startsWith("{") ? JSON.parse(raw) : YAML.parse(raw)
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid JSON/YAML",
        })
      }
      const { schema } = await dereference(root)
      if (!schema?.paths) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No paths in OpenAPI schema",
        })
      }

      // 3) compute tag order
      const tagOrder: string[] = Array.isArray(schema.tags)
        ? schema.tags.map((t) => t?.name).filter(Boolean)
        : []
      const tagIndex = new Map(tagOrder.map((t, i) => [t, i]))
      const UNTAGGED = "Untagged"

      type Op = { path: string; method: string; title: string; tag: string }
      const ops: Op[] = []
      for (const [apiPath, pathItem] of Object.entries(schema.paths)) {
        for (const m of METHODS) {
          const op = pathItem?.[m]
          if (!op) continue
          const title =
            (typeof op.summary === "string" && op.summary.trim()) ||
            (typeof op.operationId === "string" && op.operationId.trim()) ||
            `${m.toUpperCase()} ${apiPath}`
          const tag =
            Array.isArray(op.tags) && op.tags[0] ? String(op.tags[0]) : UNTAGGED
          ops.push({ path: apiPath, method: m.toUpperCase(), title, tag })
        }
      }

      // group ops by tag
      const byTag = new Map<string, Op[]>()
      for (const op of ops) {
        const list = byTag.get(op.tag) ?? []
        list.push(op)
        byTag.set(op.tag, list)
      }

      // sort tag keys by spec tag order (then alpha)
      const tagKeys = Array.from(byTag.keys()).sort((a, b) => {
        const ai = tagIndex.has(a) ? tagIndex.get(a)! : Number.MAX_SAFE_INTEGER
        const bi = tagIndex.has(b) ? tagIndex.get(b)! : Number.MAX_SAFE_INTEGER
        return ai === bi ? a.localeCompare(b) : ai - bi
      })

      // Sort ops in each tag by (path ASC, method order)
      for (const arr of byTag.values()) {
        arr.sort((a, b) => {
          if (a.path === b.path) {
            return (
              (METHOD_ORDER.get(
                a.method.toLowerCase() as (typeof METHODS)[number]
              ) ?? 99) -
              (METHOD_ORDER.get(
                b.method.toLowerCase() as (typeof METHODS)[number]
              ) ?? 99)
            )
          }
          return a.path.localeCompare(b.path)
        })
      }

      return await ctx.db.transaction(async (tx) => {
        // 1) Load existing managed rows for this spec
        const existing = await tx
          .select({
            id: documentsTable.id,
            type: documentsTable.type,
            apiPath: documentsTable.apiPath,
            apiMethod: documentsTable.apiMethod,
            apiTag: documentsTable.apiTag,
            parentId: documentsTable.parentId,
          })
          .from(documentsTable)
          .where(eq(documentsTable.specSourceId, input.parentId))

        const tagIdByName = new Map<string, string>()
        let rankCursor = 0
        const nextRank = () => String(rankCursor++).padStart(6, "0")

        // 2) Handle tags manually
        for (const tagName of tagKeys) {
          const existingTag = existing.find(
            (d) => d.type === "api_tag" && d.apiTag === tagName
          )
          if (!existingTag) {
            // insert new tag
            const tagId = crypto.randomUUID()
            await tx.insert(documentsTable).values({
              id: tagId,
              organizationId: parent.orgId,
              spaceId: parent.spaceId,
              parentId: parent.id,
              slug: slugify(tagName),
              title: tagName,
              type: "api_tag",
              apiTag: tagName,
              managedBySpec: true,
              rank: nextRank(),
              specSourceId: parent.id,
            })
            tagIdByName.set(tagName, tagId)
          } else {
            // update existing tag if title or parent changed
            await tx
              .update(documentsTable)
              .set({
                parentId: parent.id,
                title: tagName,
                slug: slugify(tagName),
                managedBySpec: true,
                updatedAt: new Date(),
              })
              .where(eq(documentsTable.id, existingTag.id))
            tagIdByName.set(tagName, existingTag.id)
          }
        }

        // 3) Handle endpoints manually
        const keepEndpointKeys = new Set<string>()
        for (const tagName of tagKeys) {
          const tagId = tagIdByName.get(tagName)!
          let innerRank = 0
          const innerNext = () => String(innerRank++).padStart(6, "0")

          for (const op of byTag.get(tagName)!) {
            const key = `${op.path}::${op.method}`
            keepEndpointKeys.add(key)

            const existingOp = existing.find(
              (d) =>
                d.type === "api" &&
                d.apiPath === op.path &&
                d.apiMethod === op.method
            )
            const baseSlug = slugify(op.title)
            let finalSlug = baseSlug
            let attempt = 0
            while (true) {
              const existingSlug = await tx
                .select({ id: documentsTable.id })
                .from(documentsTable)
                .where(
                  and(
                    eq(documentsTable.parentId, tagId),
                    eq(documentsTable.slug, finalSlug)
                  )
                )
                .limit(1)

              if (existingSlug.length === 0) {
                break
              }

              attempt++
              finalSlug = `${baseSlug}-${attempt.toString(36)}`
            }

            if (!existingOp) {
              // insert new endpoint
              await tx.insert(documentsTable).values({
                id: crypto.randomUUID(),
                organizationId: parent.orgId,
                spaceId: parent.spaceId,
                parentId: tagId,
                slug: finalSlug,
                title: op.title,
                type: "api",
                apiPath: op.path,
                apiMethod: op.method,
                managedBySpec: true,
                rank: innerNext(),
                specSourceId: parent.id,
                apiSpecBlobKey: parent.apiSpecBlobKey ?? null,
              })
            } else {
              // update existing endpoint title/parent if changed
              await tx
                .update(documentsTable)
                .set({
                  parentId: tagId,
                  title: op.title,
                  slug: finalSlug,
                  managedBySpec: true,
                  apiSpecBlobKey: parent.apiSpecBlobKey ?? null,
                  updatedAt: new Date(),
                })
                .where(eq(documentsTable.id, existingOp.id))
            }
          }
        }

        // 4) Delete removed endpoints/tags
        const toDelete = existing.filter((d) => {
          if (d.type === "api") {
            return !keepEndpointKeys.has(`${d.apiPath}::${d.apiMethod}`)
          }
          if (d.type === "api_tag") {
            return !tagIdByName.has(d.apiTag!)
          }
          return false
        })
        if (toDelete.length) {
          await tx.delete(documentsTable).where(
            inArray(
              documentsTable.id,
              toDelete.map((d) => d.id)
            )
          )
        }

        const txid = await generateTxId(tx)
        return { txid, tags: tagKeys.length, endpoints: ops.length }
      })
    }),
})
