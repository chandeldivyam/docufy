import { createFileRoute } from "@tanstack/react-router"
import { auth } from "@/lib/auth"
import { prepareElectricUrl, proxyElectricRequest } from "@/lib/electric-proxy"
import { db } from "@/db/connection"
import { documentsTable } from "@/db/schema"
import { members } from "@/db/auth-schema"
import { and, eq } from "drizzle-orm"

const sqlQuote = (s: string) => s.replaceAll("'", "''")

export const Route = createFileRoute("/api/shape/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const sess = await auth.api.getSession({ headers: request.headers })
        const userId = sess?.user?.id
        if (!userId) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          })
        }

        // The table name is the last part of the path, e.g., 'document-updates'
        const table = params._splat
        if (table !== "document_updates" && table !== "document_awareness") {
          return new Response(
            JSON.stringify({ error: "Invalid shape table" }),
            {
              status: 400,
            }
          )
        }

        const url = new URL(request.url)
        const documentId = url.searchParams.get("documentId")
        if (!documentId) {
          return new Response(
            JSON.stringify({ error: "documentId is required" }),
            {
              status: 400,
              headers: { "content-type": "application/json" },
            }
          )
        }

        // **IMPORTANT SECURITY CHECK**: Verify the user has access to this document's organization
        const [doc] = await db
          .select({ orgId: documentsTable.organizationId })
          .from(documentsTable)
          .where(eq(documentsTable.id, documentId))
          .limit(1)

        if (!doc) {
          return new Response(JSON.stringify({ error: "Document not found" }), {
            status: 404,
          })
        }

        const [membership] = await db
          .select({ id: members.id })
          .from(members)
          .where(
            and(
              eq(members.userId, userId),
              eq(members.organizationId, doc.orgId)
            )
          )
          .limit(1)

        if (!membership) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
          })
        }

        // If all checks pass, proxy the request to Electric
        const originUrl = prepareElectricUrl(request.url)
        originUrl.searchParams.set("table", table)
        originUrl.searchParams.set(
          "where",
          `document_id = '${sqlQuote(documentId)}'`
        )

        return proxyElectricRequest(originUrl)
      },
    },
  },
})
