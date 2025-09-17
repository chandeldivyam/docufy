import { createServerFileRoute } from "@tanstack/react-start/server"
import { auth } from "@/lib/auth"
import { prepareElectricUrl, proxyElectricRequest } from "@/lib/electric-proxy"

// Basic SQL string quoting to avoid breaking the where clause
const sqlQuote = (s: string) => s.replaceAll("'", "''")

export const ServerRoute = createServerFileRoute("/api/spaces").methods({
  GET: async ({ request }) => {
    const sess = await auth.api.getSession({ headers: request.headers })
    if (!sess) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    }

    const url = new URL(request.url)
    const orgId =
      url.searchParams.get("orgId") ?? sess?.session?.activeOrganizationId

    if (!orgId) {
      return new Response(JSON.stringify({ error: "No active organization" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    }

    const originUrl = prepareElectricUrl(request.url)
    originUrl.searchParams.set("table", "spaces")
    originUrl.searchParams.set(
      "where",
      `organization_id = '${sqlQuote(orgId)}'`
    )
    return proxyElectricRequest(originUrl)
  },
})
