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
import { renderMdxToHtml, getGithubMdxComponents } from "@docufy/mdx-kit"
import type { MdxRenderOptions } from "@docufy/mdx-kit"
import { parseOpenApiSpec } from "@/lib/openapi"

type EventPayload = { siteId: string; buildId: string; actorUserId?: string }

type GithubDoc = {
  id: string
  spaceSlug: string
  title: string
  path: string
  sha: string
  type: "page" | "group" | "api" | "api_spec" | "api_tag"
  slug: string
  trail: string[]
  apiSpecBlobKey?: string | null
  apiPath?: string | null
  apiMethod?: string | null
  apiTag?: string | null
  plain?: string
  order?: number
}

type UiTreeItem = {
  kind: "group" | "page" | "api" | "api_spec" | "api_tag"
  title: string
  iconSvg?: string | null
  slug: string
  route: string
  api?: {
    path: string
    method: string
    document: string
  }
  children?: UiTreeItem[]
}

const slugify = (input: string) =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80)

async function ensureGithubAsset(opts: {
  siteId: string
  branch: string
  installationId: string
  owner: string
  repo: string
  assetPath: string
  blobBaseUrl: string
  prefetched?: { content: Buffer; sha?: string | undefined }
}) {
  const {
    siteId,
    branch,
    installationId,
    owner,
    repo,
    assetPath,
    blobBaseUrl,
    prefetched,
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

  const { content, sha } =
    prefetched ??
    (await getFileBinary({
      installationId,
      owner,
      repo,
      path: assetPath,
      ref: branch,
    }))

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

async function rewriteGithubAssetsInMarkdown(opts: {
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

  const videoTagRegex = /<video[^>]*src=["']([^"']+)["'][^>]*>/gi
  rewritten = await replaceAsync(
    rewritten,
    videoTagRegex,
    async (match, p1) => {
      const url = await replaceAsset(p1.trim())
      return match.replace(p1, url)
    }
  )

  return rewritten
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

  // 1) Rewrite assets to blob URLs as before
  const rewritten = await rewriteGithubAssetsInMarkdown({
    markdown,
    siteId,
    branch,
    docPath,
    configDir,
    installationId,
    owner,
    repo,
    blobBaseUrl,
  })

  // 2) Render MDX to HTML+ToC+plain, with a components map
  const mdxOptions: MdxRenderOptions = {
    gfm: true,
    allowHtml: true,
    components: getGithubMdxComponents(),
  }

  return await renderMdxToHtml(rewritten, mdxOptions)
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

      const branch = site.githubBranch
      const docs: GithubDoc[] = []
      const missingPaths: string[] = []
      const groupNodes: Array<{
        spaceSlug: string
        title: string
        slug: string
        trail: string[]
        order: number
      }> = []

      const findSha = (p: string) => blobMap.get(p.replace(/^\.?\//, ""))

      const siblingSlugs = new Map<string, Set<string>>()
      const reserveSlug = (
        spaceSlug: string,
        parentTrail: string[],
        base: string
      ) => {
        const key =
          `${spaceSlug}:` +
          (parentTrail.length ? parentTrail.join("/") : "__root__")
        const set = siblingSlugs.get(key) ?? new Set<string>()
        let slug = base
        let attempt = 0
        while (set.has(slug)) {
          attempt++
          slug = `${base}-${attempt.toString(36)}`
        }
        set.add(slug)
        siblingSlugs.set(key, set)
        return slug
      }

      let navOrder = 0

      for (const space of normalized.navigation.spaces) {
        const walk = async (
          nodes: (typeof normalized.navigation.spaces)[number]["tree"],
          trail: string[]
        ): Promise<void> => {
          for (const node of nodes) {
            const baseSlug = slugify(node.title)
            const slug = reserveSlug(space.slug, trail, baseSlug)
            const nextTrail = trail.concat(slug)
            const nodeType = node.type ?? (node.path ? "page" : "group")

            if (nodeType === "api_spec" && node.path) {
              const repoPath = node.path.replace(/^\.?\//, "")
              const sha = findSha(repoPath)
              if (!sha) {
                missingPaths.push(repoPath)
                if (node.children?.length) {
                  await walk(node.children, nextTrail)
                }
                continue
              }

              const { content, sha: contentSha } = await getFileBinary({
                installationId: site.githubInstallationId!,
                owner,
                repo,
                path: repoPath,
                ref: branch,
              })
              const specText = content.toString("utf8")
              const specBlobUrl = await ensureGithubAsset({
                siteId,
                branch,
                installationId: site.githubInstallationId!,
                owner,
                repo,
                assetPath: repoPath,
                blobBaseUrl,
                prefetched: { content, sha: contentSha },
              })

              let parsed
              try {
                parsed = await parseOpenApiSpec(specText)
              } catch (err) {
                throw new Error(
                  `Failed to parse OpenAPI spec at ${repoPath}: ${
                    err instanceof Error ? err.message : String(err)
                  }`
                )
              }

              docs.push({
                id: `${space.slug}:${repoPath}`,
                spaceSlug: space.slug,
                title: node.title,
                path: repoPath,
                sha,
                type: "api_spec",
                slug,
                trail: nextTrail,
                apiSpecBlobKey: specBlobUrl,
                plain: "",
                order: navOrder++,
              })

              const tagIndex = new Map(parsed.tagOrder.map((t, i) => [t, i]))
              const tagNames = Array.from(
                new Set(
                  parsed.operations
                    .map((op) => op.tag)
                    .filter((t): t is string => !!t)
                )
              )
              const sortedTags = tagNames.sort((a, b) => {
                const ai = tagIndex.has(a)
                  ? tagIndex.get(a)!
                  : Number.MAX_SAFE_INTEGER
                const bi = tagIndex.has(b)
                  ? tagIndex.get(b)!
                  : Number.MAX_SAFE_INTEGER
                return ai === bi ? a.localeCompare(b) : ai - bi
              })

              for (const tagName of sortedTags) {
                const tagSlug = reserveSlug(
                  space.slug,
                  nextTrail,
                  slugify(tagName)
                )
                const tagTrail = nextTrail.concat(tagSlug)
                docs.push({
                  id: `${space.slug}:${repoPath}#tag:${tagSlug}`,
                  spaceSlug: space.slug,
                  title: tagName,
                  path: `${repoPath}#tag:${tagSlug}`,
                  sha,
                  type: "api_tag",
                  slug: tagSlug,
                  trail: tagTrail,
                  apiSpecBlobKey: specBlobUrl,
                  apiTag: tagName,
                  plain: tagName,
                  order: navOrder++,
                })

                const taggedOps = parsed.operations.filter(
                  (op) => op.tag === tagName
                )
                for (const op of taggedOps) {
                  const opSlug = reserveSlug(
                    space.slug,
                    tagTrail,
                    slugify(op.title)
                  )
                  const opTrail = tagTrail.concat(opSlug)
                  docs.push({
                    id: `${space.slug}:${repoPath}#${op.method}:${op.path}`,
                    spaceSlug: space.slug,
                    title: op.title,
                    path: `${repoPath}#${op.method}:${op.path}`,
                    sha,
                    type: "api",
                    slug: opSlug,
                    trail: opTrail,
                    apiSpecBlobKey: specBlobUrl,
                    apiPath: op.path,
                    apiMethod: op.method,
                    apiTag: tagName,
                    plain: op.plain,
                    order: navOrder++,
                  })
                }
              }

              const untagged = parsed.operations.filter((op) => !op.tag)
              for (const op of untagged) {
                const opSlug = reserveSlug(
                  space.slug,
                  nextTrail,
                  slugify(op.title)
                )
                const opTrail = nextTrail.concat(opSlug)
                docs.push({
                  id: `${space.slug}:${repoPath}#${op.method}:${op.path}`,
                  spaceSlug: space.slug,
                  title: op.title,
                  path: `${repoPath}#${op.method}:${op.path}`,
                  sha,
                  type: "api",
                  slug: opSlug,
                  trail: opTrail,
                  apiSpecBlobKey: specBlobUrl,
                  apiPath: op.path,
                  apiMethod: op.method,
                  apiTag: null,
                  plain: op.plain,
                  order: navOrder++,
                })
              }

              if (node.children?.length) {
                await walk(node.children, nextTrail)
              }
              continue
            }

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
                  type: nodeType,
                  slug,
                  trail: nextTrail,
                  order: navOrder++,
                })
              }
            } else {
              // Group without a backing file
              groupNodes.push({
                spaceSlug: space.slug,
                title: node.title,
                slug,
                trail: nextTrail,
                order: navOrder++,
              })
            }

            if (node.children?.length) {
              await walk(node.children, nextTrail)
            }
          }
        }

        await walk(space.tree, [])
      }

      if (missingPaths.length) {
        console.warn(
          `Missing configured GitHub doc paths: ${missingPaths.join(", ")}`
        )
      }

      await db
        .update(siteBuildsTable)
        .set({
          itemsTotal: docs.length,
          itemsDone: 0,
          sourceCommitSha: commitSha,
        })
        .where(eq(siteBuildsTable.id, build.id))
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

        if (
          doc.type === "api" ||
          doc.type === "api_spec" ||
          doc.type === "api_tag"
        ) {
          const bundle = {
            id: doc.id,
            title: doc.title,
            slug: doc.slug,
            trail: doc.trail,
            iconSvg: null as string | null,
            updatedAt: now,
            type: doc.type,
            apiSpecBlobKey: doc.apiSpecBlobKey ?? null,
            apiPath: doc.apiPath ?? null,
            apiMethod: doc.apiMethod ?? null,
            rendered: { html: "", toc: [] as unknown[] },
            plain: doc.plain ?? "",
            markdown: undefined as string | undefined,
            source: { kind: "github-openapi", path: doc.path },
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
          docMetadata.set(doc.id, { headings: [], plain: doc.plain ?? "" })

          await db
            .insert(siteGithubDocsTable)
            .values({
              siteId,
              branch,
              path: doc.path,
              sha: doc.sha,
              contentBlobHash: hash,
              title: doc.title,
              headings: [],
              plain: doc.plain ?? "",
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
                headings: [],
                plain: doc.plain ?? "",
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

          continue
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
          type: "page" as const,
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
      const routeFor = (spaceSlug: string, trail: string[], isApi?: boolean) =>
        isApi
          ? `/api-reference/${spaceSlug}/${trail.join("/")}`
          : `/${spaceSlug}/${trail.join("/")}`

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
          kind?: "page" | "api" | "api_spec" | "api_tag"
          api?: {
            document?: string
            path?: string
            method?: string
          } | null
          previous?: { title: string; route: string }
          next?: { title: string; route: string }
        }
      > = {}

      const routesBySpace = new Map<string, string[]>()

      for (const d of docs) {
        if (d.type !== "page" && d.type !== "api") continue
        const ref = pageRefById.get(d.id)
        if (!ref) continue
        const sizeNum =
          typeof ref.size === "string" ? Number(ref.size) : ref.size
        const route = routeFor(d.spaceSlug, d.trail, d.type === "api")
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
        if (d.type === "api" && d.apiPath && d.apiMethod && d.apiSpecBlobKey) {
          pagesIndex[route].api = {
            path: d.apiPath,
            method: d.apiMethod,
            document: d.apiSpecBlobKey,
          }
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

      type TreeCandidate = {
        spaceSlug: string
        trail: string[]
        order: number
        kind: UiTreeItem["kind"]
        title: string
        slug: string
        apiPath?: string | null
        apiMethod?: string | null
        apiSpecBlobKey?: string | null
      }

      const treeCandidates: TreeCandidate[] = []
      for (const doc of docs) {
        treeCandidates.push({
          spaceSlug: doc.spaceSlug,
          trail: doc.trail,
          order: doc.order ?? 0,
          kind: doc.type,
          title: doc.title,
          slug: doc.slug,
          apiPath: doc.apiPath ?? null,
          apiMethod: doc.apiMethod ?? null,
          apiSpecBlobKey: doc.apiSpecBlobKey ?? null,
        })
      }
      for (const group of groupNodes) {
        treeCandidates.push({
          spaceSlug: group.spaceSlug,
          trail: group.trail,
          order: group.order ?? 0,
          kind: "group",
          title: group.title,
          slug: group.slug,
        })
      }

      const uiTreeSpaces = normalized.navigation.spaces.map((space) => {
        const perSpace = treeCandidates
          .filter((c) => c.spaceSlug === space.slug)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

        type NodeWithTrail = { node: UiTreeItem; trail: string[] }
        const childrenByParent = new Map<string, NodeWithTrail[]>()
        const parentKey = (trail: string[]) =>
          `${space.slug}:` + (trail.length ? trail.join("/") : "__root__")

        for (const c of perSpace) {
          const isApiRoute = c.kind === "api"
          const node: UiTreeItem = {
            kind: c.kind,
            title: c.title,
            slug: c.slug,
            route: routeFor(space.slug, c.trail, isApiRoute),
            iconSvg: null,
          }
          if (
            c.kind === "api" &&
            c.apiPath &&
            c.apiMethod &&
            c.apiSpecBlobKey
          ) {
            node.api = {
              path: c.apiPath,
              method: c.apiMethod,
              document: c.apiSpecBlobKey,
            }
          }
          const key = parentKey(c.trail.slice(0, -1))
          const list = childrenByParent.get(key) ?? []
          list.push({ node, trail: c.trail })
          childrenByParent.set(key, list)
        }

        const build = (trail: string[]): UiTreeItem[] => {
          const key = parentKey(trail)
          const entries = childrenByParent.get(key) ?? []
          return entries.map(({ node, trail: childTrail }) => ({
            ...node,
            children: build(childTrail),
          }))
        }

        return {
          space: {
            slug: space.slug,
            name: space.name,
            iconSvg: null,
          },
          items: build([]),
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
          pages: Object.keys(pagesIndex).length,
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

      const pagesForIndex = docs
        .filter((d) => d.type === "page" || d.type === "api")
        .map((d) => {
          const meta = docMetadata.get(d.id)
          return {
            id: d.id,
            spaceSlug: d.spaceSlug,
            route: routeFor(d.spaceSlug, d.trail, d.type === "api"),
            title: d.title,
            kind: d.type === "api" ? "api" : ("page" as "api" | "page"),
            headings: meta?.headings ?? [],
            apiPath: d.apiPath ?? null,
            apiMethod: d.apiMethod ?? null,
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
