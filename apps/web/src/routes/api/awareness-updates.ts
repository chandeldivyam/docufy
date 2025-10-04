import { createFileRoute } from "@tanstack/react-router"
import { auth } from "@/lib/auth"
import { db } from "@/db/connection"
import { sql } from "drizzle-orm"
import { documentsTable } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { members } from "@/db/auth-schema"

export const Route = createFileRoute("/api/awareness-updates")({
  server: {
    handlers: {
      PUT: async ({ request }) => {
        const sess = await auth.api.getSession({ headers: request.headers })
        if (!sess?.user) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
          })
        }

        const url = new URL(request.url)
        const documentId = url.searchParams.get("documentId")
        const clientId = url.searchParams.get("clientId")
        if (!documentId || !clientId) {
          return new Response(
            JSON.stringify({ error: "documentId and clientId are required" }),
            { status: 400 }
          )
        }

        // Enforce that the caller is a member of the doc's organization
        const [doc] = await db
          .select({ orgId: documentsTable.organizationId })
          .from(documentsTable)
          .where(eq(documentsTable.id, documentId))
          .limit(1)
        if (!doc) {
          return new Response(JSON.stringify({ error: "Not Found" }), {
            status: 404,
          })
        }
        const [membership] = await db
          .select()
          .from(members)
          .where(
            and(
              eq(members.userId, sess.user.id),
              eq(members.organizationId, doc.orgId)
            )
          )
          .limit(1)
        if (!membership) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
          })
        }

        const update = new Uint8Array(await request.arrayBuffer())
        if (update.length === 0) return new Response(null, { status: 204 })

        try {
          await db.execute(sql`
            INSERT INTO document_awareness (document_id, client_id, "update")
            VALUES (${documentId}, ${clientId}, ${update})
            ON CONFLICT (document_id, client_id)
            DO UPDATE SET "update" = EXCLUDED.update, updated_at = now()
          `)
          return new Response(null, { status: 204 })
        } catch (e) {
          console.error("Failed to save awareness update:", e)
          return new Response(
            JSON.stringify({ error: "Failed to save update" }),
            {
              status: 500,
            }
          )
        }
      },
    },
  },
})
