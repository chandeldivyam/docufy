import { createServerFileRoute } from "@tanstack/react-start/server"
import { auth } from "@/lib/auth"
import { db } from "@/db/connection"
import { sql } from "drizzle-orm"
import { documentsTable } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { members } from "@/db/auth-schema"

export const ServerRoute = createServerFileRoute(
  "/api/document-updates"
).methods({
  PUT: async ({ request }) => {
    const sess = await auth.api.getSession({ headers: request.headers })
    const userId = sess?.user?.id
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      })
    }

    const url = new URL(request.url)
    const documentId = url.searchParams.get("documentId")
    if (!documentId) {
      return new Response(JSON.stringify({ error: "documentId is required" }), {
        status: 400,
      })
    }

    // Security Validation: Ensure the user has access to this document
    const [doc] = await db
      .select({ orgId: documentsTable.organizationId })
      .from(documentsTable)
      .where(eq(documentsTable.id, documentId))
      .limit(1)
    if (!doc)
      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
      })

    const [membership] = await db
      .select()
      .from(members)
      .where(
        and(eq(members.userId, userId), eq(members.organizationId, doc.orgId))
      )
      .limit(1)
    if (!membership)
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
      })

    const update = new Uint8Array(await request.arrayBuffer())
    if (update.length === 0) {
      return new Response(
        JSON.stringify({ error: "Update payload is empty" }),
        { status: 400 }
      )
    }

    try {
      await db.execute(
        sql`INSERT INTO document_updates (document_id, "update") VALUES (${documentId}, ${update})`
      )
      return new Response(null, { status: 204 })
    } catch (e) {
      console.error("Failed to save document update:", e)
      return new Response(JSON.stringify({ error: "Failed to save update" }), {
        status: 500,
      })
    }
  },
})
