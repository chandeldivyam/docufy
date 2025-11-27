// apps/web/src/inngest/functions/site-github-publish.ts
import { inngest } from "../client"
import { db } from "@/db/connection"
import {
  sitesTable,
  siteBuildsTable,
  siteContentBlobsTable,
  siteGithubDocsTable,
  siteGithubAssetsTable,
  siteDomainsTable,
  siteThemesTable,
} from "@/db/schema"
import { DocufyConfigV1Z, normalizeDocufyConfig } from "@/lib/docufy-config"
import {
  getFileBinary,
  getFileContent,
  getInstallationClient,
} from "@/lib/github"
import { and, eq } from "drizzle-orm"
import * as path from "node:path"
import { sha256, byteLengthUtf8 } from "../helpers/hash"
import {
  writeVersioned,
  writeLatestPointer,
  writeDomainPointers,
  blobPut,
} from "../helpers/blob"
import { mimeFromFilename } from "@/lib/mime"
import { makeTypesenseAdminClient } from "../helpers/typesense"

type EventPayload = { siteId: string; buildId: string; actorUserId?: string }

type GithubDoc = {
  id: string
  spaceSlug: string
  title: string
  path: string
  sha: string
  type: "page" | "group" | "api"
  slug: string
  trail: string[]
}

type TocItem = { level: number; text: string; id: string }

const slugify = (input: string) =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80)

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function toPlain(md: string) {
  return md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`>#-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

async function ensureGithubAsset(opts: {
  siteId: string
  branch: string
  installationId: string
  owner: string
  repo: string
  assetPath: string
  blobBaseUrl: string
}) {
  const {
    siteId,
    branch,
    installationId,
    owner,
    repo,
    assetPath,
    blobBaseUrl,
  } = opts

  const cached = (
    await db
      .select()
      .from(siteGithubAssetsTable)
      .where(
        and(
          eq(siteGithubAssetsTable.siteId, siteId),
          eq(siteGithubAssetsTable.branch, branch),
          eq(siteGithubAssetsTable.path, assetPath)
        )
      )
      .limit(1)
  )[0]
  if (cached) return cached.url

  const { content, sha } = await getFileBinary({
    installationId,
    owner,
    repo,
    path: assetPath,
    ref: branch,
  })

  const hash = sha ?? sha256(content.toString("binary"))
  const ext = path.posix.extname(assetPath) || ""
  const key = `sites/${siteId}/assets/${hash}${ext}`
  const contentType = mimeFromFilename(assetPath)
  const trimmedBase =
    blobBaseUrl.endsWith("/") && blobBaseUrl.length > 1
      ? blobBaseUrl.slice(0, -1)
      : blobBaseUrl

  await blobPut(key, content, contentType, { immutable: true, overwrite: true })
  const url = `${trimmedBase}/${key}`

  await db.insert(siteGithubAssetsTable).values({
    siteId,
    branch,
    path: assetPath,
    sha: sha ?? hash,
    blobKey: key,
    url,
    mimeType: contentType,
    size: content.byteLength,
    updatedAt: new Date(),
  })

  return url
}

async function renderGithubMarkdown(opts: {
  markdown: string
  siteId: string
  branch: string
  docPath: string
  configDir: string
  installationId: string
  owner: string
  repo: string
  blobBaseUrl: string
}) {
  const {
    markdown,
    siteId,
    branch,
    docPath,
    configDir,
    installationId,
    owner,
    repo,
    blobBaseUrl,
  } = opts

  const docDir = path.posix.dirname(docPath)

  const resolveAsset = (asset: string) => {
    if (/^https?:\/\//i.test(asset) || asset.startsWith("data:")) return asset
    if (asset.startsWith("/")) {
      // treat as relative to configDir for user-friendliness
      return path.posix.join(configDir, asset)
    }
    return path.posix.join(docDir, asset)
  }

  const assetMatches = new Map<string, Promise<string>>()

  const replaceAsset = (asset: string) => {
    const resolved = resolveAsset(asset)
    if (!assetMatches.has(resolved)) {
      assetMatches.set(
        resolved,
        ensureGithubAsset({
          siteId,
          branch,
          installationId,
          owner,
          repo,
          assetPath: resolved,
          blobBaseUrl,
        })
      )
    }
    return assetMatches.get(resolved)!
  }

  // Rewrite markdown image/link paths to blob URLs
  let rewritten = markdown
  const mdImageRegex = /!\[[^\]]*\]\(([^)]+)\)/g
  rewritten = await replaceAsync(rewritten, mdImageRegex, async (match, p1) => {
    const url = await replaceAsset(p1.trim())
    return match.replace(p1, url)
  })

  const imgTagRegex = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi
  rewritten = await replaceAsync(rewritten, imgTagRegex, async (match, p1) => {
    const url = await replaceAsset(p1.trim())
    return match.replace(p1, url)
  })

  // Build a minimal HTML renderer (headings + paragraphs)
  const lines = rewritten.split(/\n/)
  const htmlParts: string[] = []
  const toc: TocItem[] = []
  let para: string[] = []

  const flushPara = () => {
    if (!para.length) return
    htmlParts.push(`<p>${para.join(" ")}</p>`)
    para = []
  }

  for (const line of lines) {
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line)
    if (headingMatch) {
      flushPara()
      const level = headingMatch[1] ? Math.min(6, headingMatch[1].length) : 6
      const text = headingMatch[2] ? headingMatch[2].trim() : ""
      const id = slugify(text)
      toc.push({ level, text, id })
      htmlParts.push(`<h${level} id="${id}">${escapeHtml(text)}</h${level}>`)
      continue
    }
    if (!line.trim()) {
      flushPara()
      continue
    }
    para.push(escapeHtml(line.trim()))
  }
  flushPara()

  const html = htmlParts.join("\n")
  const plain = toPlain(rewritten)
  return { html, toc, plain }
}

async function replaceAsync(
  str: string,
  regex: RegExp,
  asyncFn: (match: string, p1: string) => Promise<string>
) {
  const promises: Promise<string>[] = []
  str.replace(regex, (match, p1) => {
    promises.push(asyncFn(match, p1))
    return match
  })
  const data = await Promise.all(promises)
  let i = 0
  return str.replace(regex, () => data[i++] ?? "")
}

async function indexDocsInTypesense({
  siteId,
  buildId,
  pages,
}: {
  siteId: string
  buildId: string
  pages: Array<{
    id: string
    spaceSlug: string
    route: string
    title: string
    kind: "page" | "api"
    headings: string[]
    apiPath?: string | null
    apiMethod?: string | null
    plain: string
    updatedAt: number
  }>
}) {
  const ts = makeTypesenseAdminClient()
  const coll = `docs_${siteId}_${buildId}`
  const alias = `docs_${siteId}`

  try {
    await ts.collections(coll).retrieve()
    await ts.collections(coll).delete()
  } catch {
    // collection missing is fine
  }

  await ts.collections().create({
    name: coll,
    token_separators: ["-", "_", "/", "."],
    fields: [
      { name: "id", type: "string" },
      { name: "site_id", type: "string", facet: true },
      { name: "build_id", type: "string", facet: true },
      { name: "space_slug", type: "string", facet: true },
      { name: "route", type: "string", infix: true },
      { name: "title", type: "string", infix: true },
      { name: "headings", type: "string[]" },
      { name: "api_method", type: "string", facet: true },
      { name: "api_path", type: "string", infix: true },
      { name: "plain", type: "string" },
      { name: "kind", type: "string", facet: true },
      { name: "updated_at", type: "int64", sort: true },
    ],
    default_sorting_field: "updated_at",
  })

  const jsonl = pages
    .map((p) =>
      JSON.stringify({
        id: p.id,
        site_id: siteId,
        build_id: buildId,
        space_slug: p.spaceSlug,
        route: p.route,
        title: p.title,
        headings: p.headings ?? [],
        api_method: p.apiMethod ?? "",
        api_path: p.apiPath ?? "",
        plain: p.plain ?? "",
        kind: p.kind,
        updated_at: p.updatedAt ?? Date.now(),
      })
    )
    .join("\n")

  await ts.collections(coll).documents().import(jsonl, { action: "upsert" })
  await ts.aliases().upsert(alias, { collection_name: coll })
}

export const siteGithubPublish = inngest.createFunction(
  { id: "site-github-publish", retries: 0 },
  { event: "site/github-publish" },
  async ({ event }) => {
    const { siteId, buildId } = event.data as EventPayload

    const [site] = await db
      .select()
      .from(sitesTable)
      .where(eq(sitesTable.id, siteId))
      .limit(1)
    if (!site) throw new Error("Site not found")
    if (site.contentSource !== "github") {
      return { skipped: true, reason: "Not a GitHub-backed site" }
    }

    const [build] = await db
      .select()
      .from(siteBuildsTable)
      .where(
        and(
          eq(siteBuildsTable.siteId, siteId),
          eq(siteBuildsTable.buildId, buildId)
        )
      )
      .limit(1)
    if (!build) throw new Error("Build not found")
    if (build.status !== "queued") return { ok: true, status: build.status }

    const markFailure = async () =>
      db
        .update(siteBuildsTable)
        .set({
          status: "failed",
          finishedAt: new Date(),
        })
        .where(eq(siteBuildsTable.id, build.id))

    try {
      await db
        .update(siteBuildsTable)
        .set({ status: "running", startedAt: new Date() })
        .where(eq(siteBuildsTable.id, build.id))

      if (
        !site.githubInstallationId ||
        !site.githubRepoFullName ||
        !site.githubBranch ||
        !site.githubConfigPath
      ) {
        throw new Error("Missing GitHub metadata on site")
      }

      const [owner, repo] = site.githubRepoFullName.split("/")
      if (!owner || !repo) throw new Error("Invalid githubRepoFullName")

      const blobBaseUrl =
        process.env.VITE_PUBLIC_VERCEL_BLOB_BASE_URL ?? site.baseUrl ?? ""
      if (!blobBaseUrl) {
        throw new Error("Blob base URL not configured")
      }

      const client = await getInstallationClient(site.githubInstallationId)

      // Load config
      const { content: configBuf } = await getFileBinary({
        installationId: site.githubInstallationId,
        owner,
        repo,
        path: site.githubConfigPath,
        ref: site.githubBranch,
      })
      const parsed = DocufyConfigV1Z.parse(
        JSON.parse(configBuf.toString("utf8"))
      )
      const configDir = path.posix.dirname(site.githubConfigPath)
      const normalized = normalizeDocufyConfig(parsed, { configDir })

      // Resolve tree once for the branch
      const branchRef = await client.request(
        "GET /repos/{owner}/{repo}/branches/{branch}",
        { owner, repo, branch: site.githubBranch }
      )
      const commitSha = branchRef.data.commit.sha
      const treeSha = branchRef.data.commit.commit.tree.sha
      const treeRes = await client.request(
        "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
        { owner, repo, tree_sha: treeSha, recursive: "1" }
      )

      const blobMap = new Map<string, string>()
      for (const t of treeRes.data.tree ?? []) {
        if (t && t.type === "blob" && t.path && t.sha) {
          const clean = (t.path as string).replace(/^\.?\//, "")
          blobMap.set(clean, t.sha as string)
        }
      }

      const docs: GithubDoc[] = []
      const missingPaths: string[] = []

      const findSha = (p: string) => blobMap.get(p.replace(/^\.?\//, ""))

      normalized.navigation.spaces.forEach((space) => {
        const walk = (
          nodes: (typeof normalized.navigation.spaces)[number]["tree"],
          trail: string[]
        ) => {
          for (const node of nodes) {
            const slug = slugify(node.title)
            const nextTrail = trail.concat(slug)

            if (node.path) {
              const repoPath = node.path.replace(/^\.?\//, "")
              const sha = findSha(repoPath)
              if (!sha) {
                missingPaths.push(repoPath)
              } else {
                docs.push({
                  id: `${space.slug}:${repoPath}`,
                  spaceSlug: space.slug,
                  title: node.title,
                  path: repoPath,
                  sha,
                  type: node.type ?? "page",
                  slug,
                  trail: nextTrail,
                })
              }
            }

            if (node.children?.length) {
              walk(node.children, nextTrail)
            }
          }
        }
        walk(space.tree, [])
      })

      await db
        .update(siteBuildsTable)
        .set({
          itemsTotal: docs.length,
          itemsDone: 0,
          sourceCommitSha: commitSha,
        })
        .where(eq(siteBuildsTable.id, build.id))

      const branch = site.githubBranch
      const existingDocs = await db
        .select()
        .from(siteGithubDocsTable)
        .where(
          and(
            eq(siteGithubDocsTable.siteId, siteId),
            eq(siteGithubDocsTable.branch, branch)
          )
        )
      const existingByPath = new Map(existingDocs.map((d) => [d.path, d]))

      const orgId = site.organizationId
      const now = new Date()
      let itemsDone = 0
      let pagesWritten = 0
      let bytesWritten = 0

      const pageRefById = new Map<
        string,
        { key: string; hash: string; size: number }
      >()
      const docMetadata = new Map<
        string,
        { headings: string[]; plain: string }
      >()

      for (const doc of docs) {
        const existing = existingByPath.get(doc.path)
        const shaUnchanged = existing && existing.sha === doc.sha

        if (shaUnchanged && existing?.contentBlobHash) {
          const blobRow = (
            await db
              .select({
                key: siteContentBlobsTable.key,
                hash: siteContentBlobsTable.hash,
                size: siteContentBlobsTable.size,
              })
              .from(siteContentBlobsTable)
              .where(
                and(
                  eq(siteContentBlobsTable.organizationId, orgId),
                  eq(siteContentBlobsTable.hash, existing.contentBlobHash)
                )
              )
              .limit(1)
          )[0]

          if (blobRow) {
            const sizeNum =
              typeof blobRow.size === "string"
                ? Number(blobRow.size)
                : (blobRow.size as number)
            pageRefById.set(doc.id, { ...blobRow, size: sizeNum })
            docMetadata.set(doc.id, {
              headings: existing.headings,
              plain: existing.plain,
            })
            itemsDone++
            await db
              .update(siteBuildsTable)
              .set({ itemsDone })
              .where(eq(siteBuildsTable.id, build.id))
            continue
          }
        }

        const raw = await getFileContent({
          installationId: site.githubInstallationId,
          owner,
          repo,
          path: doc.path,
          ref: branch,
        })

        const { html, toc, plain } = await renderGithubMarkdown({
          markdown: raw,
          siteId,
          branch,
          docPath: doc.path,
          configDir,
          installationId: site.githubInstallationId,
          owner,
          repo,
          blobBaseUrl,
        })

        const bundle = {
          id: doc.id,
          title: doc.title,
          slug: doc.slug,
          trail: doc.trail,
          iconSvg: null as string | null,
          updatedAt: now,
          type: doc.type === "api" ? "api" : ("page" as const),
          rendered: { html, toc },
          plain,
          markdown: raw,
          source: { kind: "github-mdx", path: doc.path },
        }

        const body = JSON.stringify(bundle)
        const hash = sha256(body)
        const key = `orgs/${orgId}/blobs/${hash}.json`
        const size = byteLengthUtf8(body)

        const existingBlob = (
          await db
            .select({ id: siteContentBlobsTable.id })
            .from(siteContentBlobsTable)
            .where(
              and(
                eq(siteContentBlobsTable.organizationId, orgId),
                eq(siteContentBlobsTable.hash, hash)
              )
            )
            .limit(1)
        )[0]

        if (!existingBlob) {
          await blobPut(key, body, "application/json", { immutable: true })
          await db.insert(siteContentBlobsTable).values({
            organizationId: orgId,
            hash,
            key,
            size,
          })
          pagesWritten++
          bytesWritten += size
        }

        pageRefById.set(doc.id, { key, hash, size })
        docMetadata.set(doc.id, { headings: toc.map((t) => t.text), plain })

        await db
          .insert(siteGithubDocsTable)
          .values({
            siteId,
            branch,
            path: doc.path,
            sha: doc.sha,
            contentBlobHash: hash,
            title: doc.title,
            headings: toc.map((t) => t.text),
            plain,
            size,
            kind: doc.type,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [
              siteGithubDocsTable.siteId,
              siteGithubDocsTable.branch,
              siteGithubDocsTable.path,
            ],
            set: {
              sha: doc.sha,
              contentBlobHash: hash,
              title: doc.title,
              headings: toc.map((t) => t.text),
              plain,
              size,
              kind: doc.type,
              updatedAt: now,
            },
          })

        itemsDone++
        await db
          .update(siteBuildsTable)
          .set({ itemsDone, pagesWritten, bytesWritten })
          .where(eq(siteBuildsTable.id, build.id))
      }

      // Build manifest + tree
      const nowMs = Date.now()
      const routeFor = (spaceSlug: string, trail: string[]) =>
        `/${spaceSlug}/${trail.join("/")}`

      const navSpaces = normalized.navigation.spaces.map((s, idx) => ({
        slug: s.slug,
        name: s.name,
        style: site.layout === "tabs" ? "tab" : "dropdown",
        order: idx + 1,
        iconSvg: null as string | null,
        entry: undefined as string | undefined,
      }))

      const pagesIndex: Record<
        string,
        {
          title: string
          space: string
          iconSvg?: string | null
          blob: string
          hash: string
          size: number
          lastModified: number
          kind?: "page" | "api"
          previous?: { title: string; route: string }
          next?: { title: string; route: string }
        }
      > = {}

      const routesBySpace = new Map<string, string[]>()

      for (const d of docs) {
        const ref = pageRefById.get(d.id)
        if (!ref) continue
        const sizeNum =
          typeof ref.size === "string" ? Number(ref.size) : ref.size
        const route = routeFor(d.spaceSlug, d.trail)
        if (!routesBySpace.has(d.spaceSlug)) routesBySpace.set(d.spaceSlug, [])
        routesBySpace.get(d.spaceSlug)!.push(route)

        pagesIndex[route] = {
          title: d.title,
          space: d.spaceSlug,
          iconSvg: null,
          blob: ref.key,
          hash: ref.hash,
          size: sizeNum,
          lastModified: nowMs,
          kind: d.type === "api" ? "api" : "page",
        }
      }

      for (const routes of routesBySpace.values()) {
        for (let i = 0; i < routes.length; i++) {
          const route = routes[i]!
          const prevRoute = routes[i - 1]
          const nextRoute = routes[i + 1]
          const current = pagesIndex[route]
          if (!current) continue
          if (prevRoute && pagesIndex[prevRoute]) {
            current.previous = {
              title: pagesIndex[prevRoute].title,
              route: prevRoute,
            }
          }
          if (nextRoute && pagesIndex[nextRoute]) {
            current.next = {
              title: pagesIndex[nextRoute].title,
              route: nextRoute,
            }
          }
        }
      }

      for (const ns of navSpaces) {
        const routes = routesBySpace.get(ns.slug) ?? []
        ns.entry = routes[0]
      }

      type UiTreeItem = {
        kind: "group" | "page"
        title: string
        iconSvg?: string | null
        slug: string
        route: string
        children?: UiTreeItem[]
      }

      const uiTreeSpaces = normalized.navigation.spaces.map((space) => {
        const walk = (
          nodes: typeof space.tree,
          trail: string[]
        ): UiTreeItem[] =>
          nodes.map((n) => {
            const slug = slugify(n.title)
            const nextTrail = trail.concat(slug)
            const hasPath = !!n.path
            // Use the group's own slug in the route to keep keys unique even without a path
            const route = routeFor(space.slug, nextTrail)
            const children = n.children?.length
              ? walk(n.children, nextTrail)
              : undefined
            return {
              kind: hasPath ? "page" : "group",
              title: n.title,
              slug,
              route,
              iconSvg: null,
              children,
            }
          })

        return {
          space: {
            slug: space.slug,
            name: space.name,
            iconSvg: null,
          },
          items: walk(space.tree, []),
        }
      })

      const manifest = {
        version: 3,
        contentVersion: "pm-bundle-v2",
        buildId,
        publishedAt: nowMs,
        site: {
          name: site.name,
          logoUrl: site.logoUrlLight ?? null,
          layout: site.layout,
          baseUrl: site.baseUrl,
          branding: {
            logo: {
              light: site.logoUrlLight ?? null,
              dark: site.logoUrlDark ?? site.logoUrlLight ?? null,
            },
            favicon: site.faviconUrl ? { url: site.faviconUrl } : null,
          },
        },
        routing: {
          basePath: "/",
          defaultSpace: navSpaces[0]?.slug ?? "docs",
        },
        nav: { spaces: navSpaces },
        counts: {
          pages: docs.length,
          newBlobs: pagesWritten,
          reusedBlobs: docs.length - pagesWritten,
        },
        pages: pagesIndex,
      }

      const tree = {
        version: 2,
        siteId,
        buildId,
        publishedAt: nowMs,
        nav: { spaces: navSpaces.map(({ style: _s, ...rest }) => rest) },
        spaces: uiTreeSpaces,
        buttons: (() => {
          type Pos =
            | "sidebar_top"
            | "sidebar_bottom"
            | "topbar_left"
            | "topbar_right"
          const empty: Record<
            Pos,
            Array<{
              id: string
              label: string
              href: string
              iconSvg?: string | null
              target?: "_self" | "_blank"
              slug?: string | null
            }>
          > = {
            sidebar_top: [],
            sidebar_bottom: [],
            topbar_left: [],
            topbar_right: [],
          }
          const list = Array.isArray(site.buttons) ? site.buttons : []
          const sorted = list.slice().sort((a, b) => {
            if (a.position !== b.position)
              return a.position.localeCompare(b.position)
            return (a.rank ?? 0) - (b.rank ?? 0)
          })
          for (const b of sorted) {
            if (!b || !b.position) continue
            const pos = b.position as Pos
            empty[pos].push({
              id: b.id,
              label: b.label,
              href: b.href,
              iconSvg: null,
              target: b.target ?? "_self",
              slug: b.slug ?? null,
            })
          }
          return empty
        })(),
      }

      const [themePref] =
        (await db
          .select()
          .from(siteThemesTable)
          .where(eq(siteThemesTable.siteId, siteId))
          .limit(1)) ?? []

      const themeJson = {
        version: 1,
        light: {
          tokens: themePref?.lightTokens ?? {},
          vars: themePref?.vars ?? {},
        },
        dark: { tokens: themePref?.darkTokens ?? {} },
      }

      await writeVersioned(
        siteId,
        buildId,
        "theme.json",
        JSON.stringify(themeJson)
      )
      await writeVersioned(
        siteId,
        buildId,
        "manifest.json",
        JSON.stringify(manifest)
      )
      await writeVersioned(siteId, buildId, "tree.json", JSON.stringify(tree))

      const manifestUrl = `${site.baseUrl}/sites/${siteId}/${buildId}/manifest.json`
      const treeUrl = `${site.baseUrl}/sites/${siteId}/${buildId}/tree.json`
      const themeUrl = `${site.baseUrl}/sites/${siteId}/${buildId}/theme.json`

      await writeLatestPointer(siteId, {
        buildId,
        manifestUrl,
        treeUrl,
        themeUrl,
      })

      const customDomains = await db
        .select()
        .from(siteDomainsTable)
        .where(eq(siteDomainsTable.siteId, siteId))
      await writeDomainPointers(
        [site.primaryHost, ...customDomains.map((d) => d.domain)],
        { buildId, manifestUrl, treeUrl, themeUrl }
      )

      const pagesForIndex = docs.map((d) => {
        const meta = docMetadata.get(d.id)
        return {
          id: d.id,
          spaceSlug: d.spaceSlug,
          route: routeFor(d.spaceSlug, d.trail),
          title: d.title,
          kind: d.type === "api" ? "api" : ("page" as "api" | "page"),
          headings: meta?.headings ?? [],
          apiPath: null,
          apiMethod: null,
          plain: meta?.plain ?? "",
          updatedAt: nowMs,
        }
      })

      await indexDocsInTypesense({ siteId, buildId, pages: pagesForIndex })

      await db
        .update(sitesTable)
        .set({ lastBuildId: buildId, lastPublishedAt: new Date() })
        .where(eq(sitesTable.id, siteId))
      await db
        .update(siteBuildsTable)
        .set({
          status: "success",
          finishedAt: new Date(),
          pagesWritten,
          bytesWritten,
          itemsDone,
        })
        .where(eq(siteBuildsTable.id, build.id))

      return { ok: true, buildId, docsProcessed: docs.length }
    } catch (err) {
      await markFailure()
      throw err
    }
  }
)
