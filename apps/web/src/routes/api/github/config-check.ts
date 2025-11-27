import { createFileRoute } from "@tanstack/react-router"
import { auth } from "@/lib/auth"
import { db } from "@/db/connection"
import { githubInstallations } from "@/db/schema"
import { eq } from "drizzle-orm"
import { GithubRequestError, getFileContent } from "@/lib/github"
import {
  type NormalizedNavNode,
  validateDocufyConfig,
} from "@/lib/docufy-config"
import * as path from "node:path"

function summarizeNav(nodes: NormalizedNavNode[]) {
  const byType: Record<string, number> = {}
  let total = 0

  const walk = (node: NormalizedNavNode) => {
    if (node.path) {
      total += 1
      const key = node.type ?? "page"
      byType[key] = (byType[key] ?? 0) + 1
    }
    for (const child of node.children ?? []) {
      walk(child)
    }
  }

  for (const n of nodes) walk(n)
  return { total, byType }
}

export const Route = createFileRoute("/api/github/config-check")({
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
        const branch = url.searchParams.get("branch")
        const configPath = url.searchParams.get("path")

        if (!orgId) {
          return new Response(
            JSON.stringify({ error: "No active organization" }),
            {
              status: 400,
              headers: { "content-type": "application/json" },
            }
          )
        }
        if (!installationId || !repoFullName || !branch || !configPath) {
          return new Response(
            JSON.stringify({ error: "Missing required parameters" }),
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
          const content = await getFileContent({
            installationId,
            owner,
            repo,
            path: configPath,
            ref: branch,
          })
          const previewLimit = 2000
          const preview = content.slice(0, previewLimit)
          const configDir = path.posix.dirname(configPath)
          const validated = validateDocufyConfig(content, {
            configDir,
          })
          if (!validated.ok) {
            return new Response(
              JSON.stringify({
                ok: false,
                exists: true,
                error: validated.error,
                issues: validated.issues,
                preview,
                truncated: content.length > preview.length,
              }),
              {
                status: 422,
                headers: { "content-type": "application/json" },
              }
            )
          }

          const spaceSummaries = validated.config.navigation.spaces.map((s) => {
            const stats = summarizeNav(s.tree)
            return {
              slug: s.slug,
              name: s.name,
              layout: s.style,
              docs: stats.total,
              types: stats.byType,
            }
          })

          return new Response(
            JSON.stringify({
              ok: true,
              exists: true,
              preview,
              truncated: content.length > preview.length,
              summary: {
                siteName: validated.config.site.name,
                layout: validated.config.site.layout,
                buttons: validated.config.navigation.buttons.length,
                spaces: spaceSummaries,
              },
            }),
            {
              headers: { "content-type": "application/json" },
            }
          )
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
              : "Failed to fetch config"

          return new Response(
            JSON.stringify({
              ok: false,
              exists: status !== 404,
              error: message,
            }),
            {
              status,
              headers: { "content-type": "application/json" },
            }
          )
        }
      },
    },
  },
})
