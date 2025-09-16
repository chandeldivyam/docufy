import { createServerFileRoute } from "@tanstack/react-start/server"
import { auth } from "@/lib/auth"
import { prepareElectricUrl, proxyElectricRequest } from "@/lib/electric-proxy"

const safe = (s: string) => {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error("Bad org id")
  return s
}

export const ServerRoute = createServerFileRoute("/api/organizations").methods({
  GET: async ({ request }) => {
    const sess = await auth.api.getSession({ headers: request.headers })
    if (!sess?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    }
    const orgId = sess?.session?.activeOrganizationId
    const originUrl = prepareElectricUrl(request.url)
    originUrl.searchParams.set("table", "organizations")
    if (orgId) {
      originUrl.searchParams.set("where", `id = '${safe(orgId)}'`)
    } else {
      originUrl.searchParams.set("where", "false")
    }
    return proxyElectricRequest(originUrl)
  },
})
