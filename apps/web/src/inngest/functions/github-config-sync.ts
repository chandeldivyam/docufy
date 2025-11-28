// apps/web/src/inngest/functions/github-config-sync.ts
import { inngest } from "../client"
import { db } from "@/db/connection"
import { sitesTable, siteRepoSyncsTable, siteThemesTable } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getFileBinary } from "@/lib/github"
import { normalizeDocufyConfig, DocufyConfigV1Z } from "@/lib/docufy-config"
import * as path from "node:path"
import { blobPut } from "../helpers/blob"
import { mimeFromFilename } from "@/lib/mime"
import crypto from "node:crypto"

type EventPayload = { siteId: string; triggeredBy?: string | null }

function isExternalUrl(val?: string | null) {
  if (!val) return false
  return /^https?:\/\//i.test(val) || val.startsWith("data:")
}

function hashBuffer(buf: Buffer) {
  return crypto.createHash("sha256").update(buf).digest("hex")
}

function makeButtonId(input: {
  label: string
  href: string
  position: string
  rank: number
}) {
  const raw = `${input.label}|${input.href}|${input.position}|${input.rank}`
  return crypto.createHash("md5").update(raw).digest("hex")
}

async function uploadAsset(opts: {
  siteId: string
  installationId: string
  owner: string
  repo: string
  ref: string
  assetPath: string
  baseUrl: string
}) {
  const { siteId, installationId, owner, repo, ref, assetPath, baseUrl } = opts
  const { content, sha } = await getFileBinary({
    installationId,
    owner,
    repo,
    path: assetPath,
    ref,
  })
  const hash = sha ?? hashBuffer(content)
  const ext = path.posix.extname(assetPath) || ""
  const key = `sites/${siteId}/assets/${hash}${ext}`
  const contentType = mimeFromFilename(assetPath)
  const trimmedBase =
    baseUrl.endsWith("/") && baseUrl.length > 1 ? baseUrl.slice(0, -1) : baseUrl

  try {
    await blobPut(key, content, contentType, {
      immutable: true,
      overwrite: true, // make sync idempotent when the same asset hash is re-processed
    })
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : ""
    const status =
      typeof err === "object" && err && "status" in err
        ? (err as { status?: number }).status
        : undefined
    // If the blob already exists, keep the existing URL and move on
    if (status !== 409 && !message.includes("already exists")) {
      throw err
    }
  }

  return { url: `${trimmedBase}/${key}` }
}

export const siteGithubConfigSync = inngest.createFunction(
  { id: "site-github-config-sync", retries: 0 },
  { event: "site/github-config/sync" },
  async ({ event }) => {
    const { siteId, triggeredBy } = event.data as EventPayload

    const site = (
      await db
        .select()
        .from(sitesTable)
        .where(eq(sitesTable.id, siteId))
        .limit(1)
    )[0]
    if (!site) throw new Error("Site not found")
    if (site.contentSource !== "github") {
      return { skipped: true, reason: "Not a GitHub-backed site" }
    }
    if (
      !site.githubInstallationId ||
      !site.githubRepoFullName ||
      !site.githubBranch ||
      !site.githubConfigPath
    ) {
      throw new Error("Missing GitHub metadata on site")
    }

    const [owner, repo] = site.githubRepoFullName.split("/")
    if (!owner || !repo) {
      throw new Error("Invalid githubRepoFullName on site")
    }
    const blobBaseUrl =
      process.env.VITE_PUBLIC_VERCEL_BLOB_BASE_URL ?? site.baseUrl ?? ""
    if (!blobBaseUrl) {
      throw new Error("Blob base URL not configured")
    }
    const syncRow = await db
      .insert(siteRepoSyncsTable)
      .values({
        siteId,
        organizationId: site.organizationId,
        status: "running",
        branch: site.githubBranch,
        configPath: site.githubConfigPath,
        triggeredBy: triggeredBy ?? null,
      })
      .returning({ id: siteRepoSyncsTable.id })

    const syncId = syncRow[0]?.id ?? null
    const assetWarnings: string[] = []

    const markFailure = async (message: string) => {
      await db.transaction(async (tx) => {
        await tx
          .update(sitesTable)
          .set({
            githubConfigStatus: "failed",
            githubConfigError: message,
            githubConfigSyncedAt: new Date(),
          })
          .where(eq(sitesTable.id, siteId))
        if (syncId) {
          await tx
            .update(siteRepoSyncsTable)
            .set({
              status: "failed",
              error: message,
              finishedAt: new Date(),
            })
            .where(eq(siteRepoSyncsTable.id, syncId))
        }
      })
    }

    try {
      await db
        .update(sitesTable)
        .set({ githubConfigStatus: "running", githubConfigError: null })
        .where(eq(sitesTable.id, siteId))

      // Load config
      const { content: configBuf, sha: configSha } = await getFileBinary({
        installationId: site.githubInstallationId!,
        owner,
        repo,
        path: site.githubConfigPath!,
        ref: site.githubBranch!,
      })
      const configStr = configBuf.toString("utf8")
      const parsed = DocufyConfigV1Z.safeParse(JSON.parse(configStr))
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.message).join("; ")
        throw new Error(`Config validation failed: ${issues}`)
      }
      const configDir = path.posix.dirname(site.githubConfigPath)
      const normalized = normalizeDocufyConfig(parsed.data, {
        configDir,
      })

      const brandingUploads: {
        logoLight?: string
        logoDark?: string
        favicon?: string
      } = {}

      const maybeUpload = async (
        assetPath: string | undefined
      ): Promise<string | undefined> => {
        if (!assetPath) return undefined
        if (isExternalUrl(assetPath)) return assetPath
        try {
          const { url } = await uploadAsset({
            siteId,
            installationId: site.githubInstallationId!,
            owner: owner as string,
            repo: repo as string,
            ref: site.githubBranch!,
            assetPath,
            baseUrl: blobBaseUrl,
          })
          return url
        } catch (err) {
          const msg =
            err instanceof Error
              ? err.message
              : "Failed to upload asset from config"
          assetWarnings.push(`Asset ${assetPath} skipped: ${msg}`)
          return undefined
        }
      }

      brandingUploads.logoLight = await maybeUpload(
        normalized.branding.logo.light
      )
      brandingUploads.logoDark = await maybeUpload(
        normalized.branding.logo.dark
      )
      brandingUploads.favicon = await maybeUpload(normalized.branding.favicon)

      // Build buttons payload with stable ids
      const buttons = normalized.navigation.buttons.map((btn, idx) => ({
        id: makeButtonId({
          label: btn.label,
          href: btn.href,
          position: btn.position,
          rank: btn.rank,
        }),
        label: btn.label,
        href: btn.href,
        iconName: btn.icon ?? null,
        slug: null,
        position: btn.position,
        rank: btn.rank ?? idx,
        target: btn.target ?? "_self",
      }))

      await db.transaction(async (tx) => {
        await tx
          .update(sitesTable)
          .set({
            name: normalized.site.name,
            layout: normalized.site.layout,
            buttons,
            logoUrlLight: brandingUploads.logoLight ?? null,
            logoUrlDark: brandingUploads.logoDark ?? null,
            faviconUrl: brandingUploads.favicon ?? null,
            githubConfigStatus: "success",
            githubConfigSyncedAt: new Date(),
            githubConfigSha: configSha ?? null,
            githubConfigVersion: normalized.version,
            githubConfigError: null,
          })
          .where(eq(sitesTable.id, siteId))

        // upsert theme
        const existing = (
          await tx
            .select({ siteId: siteThemesTable.siteId })
            .from(siteThemesTable)
            .where(eq(siteThemesTable.siteId, siteId))
            .limit(1)
        )[0]

        if (existing) {
          await tx
            .update(siteThemesTable)
            .set({
              version: normalized.theme.version,
              lightTokens: normalized.theme.light,
              darkTokens: normalized.theme.dark,
              vars: normalized.theme.vars,
            })
            .where(eq(siteThemesTable.siteId, siteId))
        } else {
          await tx.insert(siteThemesTable).values({
            siteId,
            organizationId: site.organizationId,
            version: normalized.theme.version,
            lightTokens: normalized.theme.light,
            darkTokens: normalized.theme.dark,
            vars: normalized.theme.vars,
          })
        }

        if (syncId) {
          await tx
            .update(siteRepoSyncsTable)
            .set({
              status: "success",
              configSha: configSha ?? null,
              error: assetWarnings.length ? assetWarnings.join("; ") : null,
              finishedAt: new Date(),
            })
            .where(eq(siteRepoSyncsTable.id, syncId))
        }
      })

      return {
        siteId,
        synced: true,
        configSha: configSha ?? null,
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to sync GitHub config"
      await markFailure(message)
      throw err
    }
  }
)
