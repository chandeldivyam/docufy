import { createFileRoute } from "@tanstack/react-router"
import { auth } from "@/lib/auth"
import { db } from "@/db/connection"
import { githubInstallations, githubRepositories } from "@/db/schema"
import {
  GithubRequestError,
  getInstallation,
  listInstallationRepos,
} from "@/lib/github"
import { eq } from "drizzle-orm"

function parseOrgId(state: string | null): string | null {
  if (!state) return null
  try {
    const parsed = JSON.parse(state)
    if (typeof parsed === "string") return parsed
    if (parsed && typeof parsed === "object" && parsed.organizationId) {
      return parsed.organizationId as string
    }
  } catch {
    // If state is not JSON, fall through to treat it as raw orgId
  }
  return state
}

function renderHtml(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html" },
  })
}

function renderError(message: string, status = 500) {
  return new Response(message, {
    status,
    headers: { "content-type": "text/plain" },
  })
}

export const Route = createFileRoute("/api/github/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const sess = await auth.api.getSession({ headers: request.headers })
        if (!sess?.user) {
          return new Response("Unauthorized", { status: 401 })
        }

        const url = new URL(request.url)
        const installationId = url.searchParams.get("installation_id")
        const setupAction = url.searchParams.get("setup_action")
        const orgFromState = parseOrgId(url.searchParams.get("state"))
        const orgId = orgFromState

        if (!installationId) {
          return new Response("Missing installation_id", { status: 400 })
        }
        if (!orgId) {
          return new Response("Missing organization context", { status: 400 })
        }

        try {
          const inst = await getInstallation(installationId)
          const repos = await listInstallationRepos(installationId)

          const account = inst.data.account
          const accountLogin =
            account && "login" in account
              ? account.login
              : (account?.slug ?? "")
          const accountType =
            account && "type" in account
              ? account.type
              : account
                ? // Enterprise installations don't expose `login`/`type`; use a stable label
                  "Enterprise"
                : "Organization"

          await db.transaction(async (tx) => {
            await tx
              .insert(githubInstallations)
              .values({
                id: installationId,
                organizationId: orgId,
                accountLogin,
                accountType,
              })
              .onConflictDoUpdate({
                target: githubInstallations.id,
                set: {
                  organizationId: orgId,
                  accountLogin,
                  accountType,
                },
              })

            await tx
              .delete(githubRepositories)
              .where(eq(githubRepositories.installationId, installationId))

            if (repos.length) {
              await tx.insert(githubRepositories).values(
                repos.map((repo) => ({
                  installationId,
                  fullName: repo.fullName,
                  defaultBranch: repo.defaultBranch,
                  private: repo.private,
                }))
              )
            }
          })

          const body = `<p>GitHub App ${
            setupAction === "update" ? "updated" : "installed"
          } for this organization. You can close this tab.</p>`
          return renderHtml(body)
        } catch (error) {
          console.error("GitHub installation callback failed", error)
          const status =
            error instanceof GithubRequestError && error.status
              ? error.status >= 500
                ? 502
                : 400
              : 500
          const message =
            error instanceof GithubRequestError || error instanceof Error
              ? error.message
              : "Unknown error"
          return renderError(
            `GitHub setup failed. ${message}. Please retry from settings.`,
            status
          )
        }
      },
    },
  },
})
