// apps/web/src/routes/api/sites/$siteId/search-key.ts
import { createFileRoute } from "@tanstack/react-router"
import { db } from "@/db/connection"
import { sitesTable, siteSearchKeysTable } from "@/db/schema"
import { eq } from "drizzle-orm"
import {
  makeTypesenseAdminClient,
  getTypesenseNodes,
} from "@/inngest/helpers/typesense"

function bearerOk(req: Request) {
  const incoming = req.headers.get("authorization") || ""
  const expected = (process.env.DOCS_SEARCH_SHARED_SECRET || "").trim()
  return expected && incoming === `Bearer ${expected}`
}

export const Route = createFileRoute("/api/sites/$siteId/search-key")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        if (!bearerOk(request))
          return new Response("Unauthorized", { status: 401 })

        const { siteId } = params as { siteId: string }
        const [site] = await db
          .select()
          .from(sitesTable)
          .where(eq(sitesTable.id, siteId))
          .limit(1)
        if (!site) return new Response("Not found", { status: 404 })

        const alias = `docs_${siteId}`
        const ts = makeTypesenseAdminClient()
        const now = Math.floor(Date.now() / 1000)

        // 1) Get or create parent search-only key limited to this alias
        const parent = (
          await db
            .select()
            .from(siteSearchKeysTable)
            .where(eq(siteSearchKeysTable.siteId, siteId))
            .limit(1)
        )[0]

        let parentKey = parent?.keyValue || ""
        const parentTtl = 60 * 60 * 24 * 14

        const needsNewParent =
          !parentKey ||
          (parent?.expiresAt &&
            Math.floor(parent.expiresAt.getTime() / 1000) < now + 3600)

        if (needsNewParent) {
          const created = await ts.keys().create({
            description: `docs search parent key for ${alias}`,
            actions: ["documents:search"],
            collections: [alias],
            expires_at: now + parentTtl,
            autodelete: true,
          })

          if (!created.value) {
            return new Response("Failed to create parent key", { status: 500 })
          }
          parentKey = created.value
          const expiresAt = new Date((now + parentTtl) * 1000)
          if (parent) {
            await db
              .update(siteSearchKeysTable)
              .set({ keyValue: parentKey, expiresAt })
              .where(eq(siteSearchKeysTable.siteId, siteId))
          } else {
            await db
              .insert(siteSearchKeysTable)
              .values({ siteId, keyValue: parentKey, expiresAt })
          }
        }

        // 2) Generate a short-lived scoped key (embed safe defaults)
        const scopedTtl = 15 * 60
        const expiresAt = now + scopedTtl

        const scopedKey = ts.keys().generateScopedSearchKey(parentKey, {
          // NOTE: we keep queryBy et al in the client as adapter defaults
          limit_multi_searches: 10,
          expires_at: expiresAt,
          // You can also pin non-overridable params here if desired:
          // exclude_fields: "plain"
        })

        // 3) Return config to the renderer
        return new Response(
          JSON.stringify({
            collection: alias,
            nodes: getTypesenseNodes(),
            key: scopedKey,
            expiresAt: new Date(expiresAt * 1000).toISOString(),
            defaults: {
              queryBy: "title,headings,plain,api_path,route",
              queryByWeights: "8,3,1,5,2",
              numTypos: 2,
              highlightFullFields: "title,plain",
              infix: "fallback",
            },
          }),
          {
            headers: {
              "content-type": "application/json",
              "cache-control": "no-store",
            },
          }
        )
      },
    },
  },
})
