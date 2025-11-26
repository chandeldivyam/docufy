import { createFileRoute } from "@tanstack/react-router"
import { auth } from "@/lib/auth"
import { prepareElectricUrl, proxyElectricRequest } from "@/lib/electric-proxy"
import { db } from "@/db/connection"
import { githubInstallations } from "@/db/schema"
import { eq } from "drizzle-orm"

const sqlQuote = (s: string) => s.replaceAll("'", "''")

export const Route = createFileRoute("/api/github-repositories")({
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
          url.searchParams.get("orgId") ?? sess.session?.activeOrganizationId
        const requestedInstallationId = url.searchParams.get("installationId")

        if (!orgId) {
          return new Response(
            JSON.stringify({ error: "No active organization" }),
            {
              status: 400,
              headers: { "content-type": "application/json" },
            }
          )
        }

        // Resolve installation and enforce org ownership
        let installationId = requestedInstallationId
        if (installationId) {
          const row = (
            await db
              .select({
                organizationId: githubInstallations.organizationId,
                id: githubInstallations.id,
              })
              .from(githubInstallations)
              .where(eq(githubInstallations.id, installationId))
              .limit(1)
          )[0]

          if (!row) {
            return new Response(
              JSON.stringify({ error: "Installation not found" }),
              {
                status: 404,
                headers: { "content-type": "application/json" },
              }
            )
          }
          if (row.organizationId !== orgId) {
            return new Response(
              JSON.stringify({ error: "Installation not in organization" }),
              {
                status: 403,
                headers: { "content-type": "application/json" },
              }
            )
          }
        } else {
          const row = (
            await db
              .select({ id: githubInstallations.id })
              .from(githubInstallations)
              .where(eq(githubInstallations.organizationId, orgId))
              .limit(1)
          )[0]
          installationId = row?.id ?? null
        }

        if (!installationId) {
          return new Response(
            JSON.stringify({
              error: "No GitHub installation found for this organization",
            }),
            {
              status: 404,
              headers: { "content-type": "application/json" },
            }
          )
        }

        const originUrl = prepareElectricUrl(request.url)
        originUrl.searchParams.set("table", "github_repositories")
        originUrl.searchParams.set(
          "where",
          `installation_id = '${sqlQuote(installationId)}'`
        )
        // Avoid leaking other installations by pinning the filter
        originUrl.searchParams.delete("installationId")
        originUrl.searchParams.set("orgId", orgId)

        return proxyElectricRequest(originUrl)
      },
    },
  },
})
