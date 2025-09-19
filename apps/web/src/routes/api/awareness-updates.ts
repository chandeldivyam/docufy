import { createServerFileRoute } from "@tanstack/react-start/server"
import { auth } from "@/lib/auth"
import { db } from "@/db/connection"
import { sql } from "drizzle-orm"
// NOTE: For brevity, this example omits the same security validation as above, but you MUST add it.

export const ServerRoute = createServerFileRoute(
  "/api/awareness-updates"
).methods({
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
      return new Response(JSON.stringify({ error: "Failed to save update" }), {
        status: 500,
      })
    }
  },
})
