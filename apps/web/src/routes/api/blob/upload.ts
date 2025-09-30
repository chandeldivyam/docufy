import { createServerFileRoute } from "@tanstack/react-start/server"
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { and, eq } from "drizzle-orm"

import { db } from "@/db/connection"
import { members } from "@/db/auth-schema"
import { documentsTable, sitesTable } from "@/db/schema"
import { auth } from "@/lib/auth"

export const ServerRoute = createServerFileRoute("/api/blob/upload").methods({
  POST: async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers })
    const userId = session?.user?.id

    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    }

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch (error) {
      console.log("Invalid JSON body", error)
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    }

    const body = (rawBody ?? {}) as HandleUploadBody & {
      clientPayload?: unknown
    }

    const clientPayloadValue = body.clientPayload
    let clientPayloadString: string | undefined
    let parsedPayload: Record<string, unknown> = {}
    try {
      if (typeof clientPayloadValue === "string") {
        clientPayloadString = clientPayloadValue
        parsedPayload = JSON.parse(clientPayloadValue) as Record<
          string,
          unknown
        >
      } else if (clientPayloadValue && typeof clientPayloadValue === "object") {
        clientPayloadString = JSON.stringify(clientPayloadValue)
        parsedPayload = clientPayloadValue as Record<string, unknown>
      }
    } catch (error) {
      console.log("Invalid clientPayload", error)
      return new Response(JSON.stringify({ error: "Invalid clientPayload" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    }

    body.clientPayload = clientPayloadString

    let documentId = parsedPayload.documentId as string | undefined
    let siteId = parsedPayload.siteId as string | undefined

    if (!documentId && !siteId) {
      const pathname = (body as { payload?: { pathname?: string } }).payload
        ?.pathname
      if (typeof pathname === "string") {
        const segments = pathname.split("/").filter(Boolean)
        if (segments.length >= 5 && segments[3] === "branding") {
          // assets/{orgSlug}/{siteId}/branding/...
          siteId = segments[2]
        } else if (segments.length >= 3) {
          // assets/{orgSlug}/{documentId}/...
          documentId = segments[2]
        }
      }
    }

    if (!documentId && !siteId) {
      return new Response(
        JSON.stringify({ error: "Missing documentId or siteId" }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      )
    }

    const document = documentId
      ? await db
          .select({ organizationId: documentsTable.organizationId })
          .from(documentsTable)
          .where(eq(documentsTable.id, documentId))
          .limit(1)
          .then((rows) => rows[0])
      : null

    const site = siteId
      ? await db
          .select({ organizationId: sitesTable.organizationId })
          .from(sitesTable)
          .where(eq(sitesTable.id, siteId))
          .limit(1)
          .then((rows) => rows[0])
      : null

    const orgId = document?.organizationId ?? site?.organizationId
    if (!orgId) {
      return new Response(JSON.stringify({ error: "Target not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      })
    }

    const membership = await db
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.userId, userId), eq(members.organizationId, orgId)))
      .limit(1)
      .then((rows) => rows[0])

    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      })
    }

    const json = await handleUpload({
      request,
      body: body as HandleUploadBody,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "image/png",
          "image/jpeg",
          "image/webp",
          "image/gif",
          "image/svg+xml",
          "image/x-icon",
          "image/vnd.microsoft.icon",
          "application/json",
          "application/yaml",
          "application/x-yaml",
          "text/yaml",
          "text/plain",
        ],
        addRandomSuffix: false,
        tokenPayload: JSON.stringify({ userId, documentId, siteId }),
      }),
      onUploadCompleted: async () => {},
    })

    return new Response(JSON.stringify(json), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  },
})
