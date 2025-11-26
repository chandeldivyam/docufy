import { createFileRoute } from "@tanstack/react-router"
import { auth } from "@/lib/auth"
import { db } from "@/db/connection"
import { githubInstallations } from "@/db/schema"
import { eq } from "drizzle-orm"
import { GithubRequestError, getInstallationClient } from "@/lib/github"

export const Route = createFileRoute("/api/github/branches")({
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
        const installationId = url.searchParams.get("installationId")
        const repoFullName = url.searchParams.get("repo")
        const query = url.searchParams.get("q")?.toLowerCase().trim()
        const preferredBranch = url.searchParams.get("defaultBranch")?.trim()

        if (!orgId) {
          return new Response(
            JSON.stringify({ error: "No active organization" }),
            {
              status: 400,
              headers: { "content-type": "application/json" },
            }
          )
        }
        if (!installationId || !repoFullName) {
          return new Response(
            JSON.stringify({ error: "Missing installation or repo" }),
            {
              status: 400,
              headers: { "content-type": "application/json" },
            }
          )
        }

        const [owner, repo] = repoFullName.split("/")
        if (!owner || !repo) {
          return new Response(
            JSON.stringify({ error: "Invalid repo full name" }),
            {
              status: 400,
              headers: { "content-type": "application/json" },
            }
          )
        }

        const install = (
          await db
            .select({
              id: githubInstallations.id,
              organizationId: githubInstallations.organizationId,
            })
            .from(githubInstallations)
            .where(eq(githubInstallations.id, installationId))
            .limit(1)
        )[0]

        if (!install) {
          return new Response(
            JSON.stringify({ error: "Installation not found" }),
            {
              status: 404,
              headers: { "content-type": "application/json" },
            }
          )
        }

        if (install.organizationId !== orgId) {
          return new Response(
            JSON.stringify({ error: "Installation not in organization" }),
            {
              status: 403,
              headers: { "content-type": "application/json" },
            }
          )
        }

        try {
          const client = await getInstallationClient(installationId)
          const res = await client.request(
            "GET /repos/{owner}/{repo}/branches",
            {
              owner,
              repo,
              per_page: 100,
            }
          )

          let branches = res.data.map((b) => b.name)
          if (preferredBranch) {
            branches = [
              preferredBranch,
              ...branches.filter((b) => b !== preferredBranch),
            ]
          }
          if (query) {
            branches = branches.filter((b) => b.toLowerCase().includes(query))
          }

          return new Response(JSON.stringify({ branches }), {
            headers: { "content-type": "application/json" },
          })
        } catch (error) {
          const status =
            error instanceof GithubRequestError && error.status
              ? error.status >= 500
                ? 502
                : error.status
              : 500
          const message =
            error instanceof GithubRequestError || error instanceof Error
              ? error.message
              : "Failed to load branches"
          return new Response(JSON.stringify({ error: message }), {
            status,
            headers: { "content-type": "application/json" },
          })
        }
      },
    },
  },
})
