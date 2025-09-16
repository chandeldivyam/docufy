import { createServerFileRoute } from "@tanstack/react-start/server"
import { auth } from "@/lib/auth"
import { prepareElectricUrl, proxyElectricRequest } from "@/lib/electric-proxy"

const safe = (s: string) => {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error("Bad org id")
  return s
}

export const ServerRoute = createServerFileRoute("/api/members").methods({
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
      url.searchParams.get("orgId") ??
      sess?.session?.activeOrganizationId

    if (!orgId) {
      return new Response(JSON.stringify({ error: "No active organization" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    }

    const originUrl = prepareElectricUrl(request.url)
    originUrl.searchParams.set("table", "members")
    originUrl.searchParams.set("where", `organization_id = '${safe(orgId)}'`)
    return proxyElectricRequest(originUrl)
  },
})
