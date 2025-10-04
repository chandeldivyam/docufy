import { createFileRoute } from "@tanstack/react-router"
import { auth } from "@/lib/auth"
import { prepareElectricUrl, proxyElectricRequest } from "@/lib/electric-proxy"

// Basic SQL string quoting to avoid breaking the where clause
const sqlQuote = (s: string) => s.replaceAll("'", "''")

export const Route = createFileRoute("/api/user-invitations")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const sess = await auth.api.getSession({ headers: request.headers })
        const email = sess?.user?.email as string | undefined
        if (!email) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          })
        }

        const originUrl = prepareElectricUrl(request.url)
        originUrl.searchParams.set("table", "invitations")
        originUrl.searchParams.set(
          "where",
          `email = '${sqlQuote(email)}' and status = 'pending'`
        )
        return proxyElectricRequest(originUrl)
      },
    },
  },
})
