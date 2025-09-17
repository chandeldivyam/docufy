import { createServerFileRoute } from "@tanstack/react-start/server"
import { auth } from "@/lib/auth"
import { prepareElectricUrl, proxyElectricRequest } from "@/lib/electric-proxy"

export const ServerRoute = createServerFileRoute(
  "/api/my-organizations"
).methods({
  GET: async ({ request }) => {
    const sess = await auth.api.getSession({ headers: request.headers })
    if (!sess) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    }
    const userId = sess?.user?.id
    if (!userId) {
      return new Response(JSON.stringify({ error: "No user id" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    }
    const originUrl = prepareElectricUrl(request.url)
    originUrl.searchParams.set("table", "org_user_profiles")
    originUrl.searchParams.set("where", `user_id = '${userId}'`)
    return proxyElectricRequest(originUrl)
  },
})
