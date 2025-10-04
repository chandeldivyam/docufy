import { createFileRoute } from "@tanstack/react-router"
import { auth } from "@/lib/auth"
import { prepareElectricUrl, proxyElectricRequest } from "@/lib/electric-proxy"

const sqlQuote = (s: string) => s.replaceAll("'", "''")

export const Route = createFileRoute("/api/site-builds")({
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
        const orgId = sess.session?.activeOrganizationId
        const siteId = url.searchParams.get("siteId")

        if (!orgId || !siteId) {
          return new Response(
            JSON.stringify({ error: "Missing org or site" }),
            {
              status: 400,
              headers: { "content-type": "application/json" },
            }
          )
        }

        const originUrl = prepareElectricUrl(request.url)
        originUrl.searchParams.set("table", "site_builds")
        originUrl.searchParams.set(
          "where",
          `site_id = '${sqlQuote(siteId)}' and organization_id = '${sqlQuote(orgId)}'`
        )
        return proxyElectricRequest(originUrl)
      },
    },
  },
})
