import { createFileRoute } from "@tanstack/react-router"
import { auth } from "@/lib/auth"
import { prepareElectricUrl, proxyElectricRequest } from "@/lib/electric-proxy"

export const Route = createFileRoute("/api/org-user-profiles")({
  server: {
    handlers: {
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
          return new Response(
            JSON.stringify({ error: "No active organization" }),
            {
              status: 400,
              headers: { "content-type": "application/json" },
            }
          )
        }
        const originUrl = prepareElectricUrl(request.url)
        originUrl.searchParams.set("table", "org_user_profiles")
        originUrl.searchParams.set("where", `organization_id = '${orgId}'`)
        return proxyElectricRequest(originUrl)
      },
    },
  },
})
