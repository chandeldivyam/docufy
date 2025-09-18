import { createServerFileRoute } from "@tanstack/react-start/server"
import { auth } from "@/lib/auth"
import { prepareElectricUrl, proxyElectricRequest } from "@/lib/electric-proxy"

const sqlQuote = (s: string) => s.replaceAll("'", "''")

export const ServerRoute = createServerFileRoute("/api/documents").methods({
  GET: async ({ request }) => {
    const sess = await auth.api.getSession({ headers: request.headers })
    if (!sess) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    }

    const url = new URL(request.url)
    const orgId = sess.session?.activeOrganizationId
    const spaceId = url.searchParams.get("spaceId")
    if (!orgId || !spaceId) {
      return new Response(JSON.stringify({ error: "Missing org or space" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    }

    const originUrl = prepareElectricUrl(request.url)
    originUrl.searchParams.set("table", "documents")
    originUrl.searchParams.set(
      "where",
      `organization_id = '${sqlQuote(orgId)}' and space_id = '${sqlQuote(
        spaceId
      )}' and archived_at is null`
    )
    return proxyElectricRequest(originUrl)
  },
})
