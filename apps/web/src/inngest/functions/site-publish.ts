// apps/web/src/inngest/functions/site-publish.ts
import { inngest } from "../client"
import { db } from "@/db/connection"
import {
  sitesTable,
  siteBuildsTable,
  spacesTable,
  documentsTable,
  siteContentBlobsTable,
  siteDomainsTable,
  siteThemesTable,
} from "@/db/schema"
import { and, eq, inArray, asc } from "drizzle-orm"
import { sql } from "drizzle-orm"
import {
  writeVersioned,
  writeLatestPointer,
  writeDomainPointers,
  blobPut,
} from "../helpers/blob"
import { sha256, byteLengthUtf8 } from "../helpers/hash"
import { makeTypesenseAdminClient } from "../helpers/typesense"
import * as Y from "yjs"
import { yDocToProsemirrorJSON } from "y-prosemirror"
import type { JSONContent } from "@tiptap/core"
import {
  serialize as serializeContent,
  type TocItem,
} from "@docufy/content-kit/renderer" // ✅ use your renderer
import { toMarkdown } from "@docufy/content-kit/markdown"

type NavSpace = {
  slug: string
  name: string
  style: "dropdown" | "tab"
  order: number
  iconName?: string | null
  entry?: string
}
type PageIndexEntry = {
  title: string
  space: string
  iconName?: string | null
  blob: string
  hash: string
  size: number
  lastModified: number
  kind?: "page" | "api_spec" | "api" | "api_tag"
  api?: {
    document?: string
    path?: string
    method?: string
  }
  previous?: { title: string; route: string } | null
  next?: { title: string; route: string } | null
}

// --- helpers ---

function normalizeUuidList(val: unknown): string[] {
  if (Array.isArray(val)) return val as string[]
  if (typeof val === "string") {
    const s = val.trim()
    if (s.startsWith("{") && s.endsWith("}")) {
      return s
        .slice(1, -1)
        .split(",")
        .map((x) => x.trim().replace(/^"(.*)"$/, "$1"))
        .filter(Boolean)
    }
    return [s]
  }
  return []
}

// Convert PG bytea (Buffer) or hex string to Uint8Array
function toUint8(value: unknown): Uint8Array | null {
  if (!value) return null
  if (value instanceof Uint8Array) return value
  // node-postgres usually returns Buffer for bytea:
  if (typeof Buffer !== "undefined" && value instanceof Buffer)
    return new Uint8Array(value as Buffer)
  if (typeof value === "string") {
    const s = value.startsWith("\\x") ? value.slice(2) : value
    const arr = s.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? []
    return new Uint8Array(arr)
  }
  return null
}

// Load & merge all Yjs updates for a given document id
async function loadPmJsonFromYUpdates(
  documentId: string
): Promise<JSONContent> {
  const res = await db.execute(sql`
    select "update" from document_updates
    where document_id = ${documentId}
    order by id asc
  `)
  const updates: Uint8Array[] = []
  for (const row of res.rows as Array<{ update: Uint8Array }>) {
    const u = toUint8(row.update)
    if (u && u.length) updates.push(u)
  }

  if (updates.length === 0) {
    // brand new doc with no updates yet – empty PM doc
    return { type: "doc", content: [] }
  }

  const merged = Y.mergeUpdates(updates) // efficient, idempotent
  const ydoc = new Y.Doc()
  Y.applyUpdate(ydoc, merged)

  // The Tiptap Collaboration default fragment is 'default'
  // If you ever set Collaboration.configure({ field: 'something' }),
  // pass that here instead of 'default'.
  const pm = yDocToProsemirrorJSON(ydoc, "default") as JSONContent
  return pm ?? { type: "doc", content: [] }
}

// Extract crude plaintext from PM JSON (used for search/snippets)
function extractPlain(pm: JSONContent | null): string {
  if (!pm) return ""
  const parts: string[] = []
  const walk = (n: JSONContent) => {
    if (!n) return
    if (n.type === "text" && typeof n.text === "string") parts.push(n.text)
    if (Array.isArray(n.content)) n.content.forEach(walk)
  }
  walk(pm)
  return parts.join(" ")
}

// small helper that uses blobPut with immutable caching
async function writeBlobImmutable(key: string, content: string) {
  await blobPut(key, content, "application/json", { immutable: true })
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

  // 1) Create (or recreate) the versioned collection
  try {
    await ts.collections(coll).retrieve()
    await ts.collections(coll).delete()
  } catch {
    console.log("Collection not found!")
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

  // 2) JSONL bulk upsert (fastest path)
  // Create compact objects and stream as JSON lines
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

  await ts.collections(coll).documents().import(jsonl, { action: "upsert" }) // bulk upsert :contentReference[oaicite:23]{index=23}

  // 3) Swap alias atomically to the new collection
  // If alias exists, update; else create
  try {
    await ts.aliases().upsert(alias, { collection_name: coll })
  } catch {
    console.log("Alias not found!")
  } // Collection Alias :contentReference[oaicite:24]{index=24}
}

export const sitePublish = inngest.createFunction(
  { id: "site-publish" },
  { event: "site/publish" },
  async ({ event }) => {
    const { siteId, buildId } = event.data as {
      siteId: string
      buildId: string
    }

    // 1) Load site & build
    const [site] = await db
      .select()
      .from(sitesTable)
      .where(eq(sitesTable.id, siteId))
      .limit(1)
    if (!site) throw new Error("Site not found")

    const [themePref] =
      (await db
        .select()
        .from(siteThemesTable)
        .where(eq(siteThemesTable.siteId, siteId))
        .limit(1)) ?? []

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

    // Mark running
    await db
      .update(siteBuildsTable)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(siteBuildsTable.id, build.id))

    const selectedSpaceIds = normalizeUuidList(build.selectedSpaceIdsSnapshot)

    // 2) Fetch spaces in that order
    const spaces = selectedSpaceIds.length
      ? await db
          .select()
          .from(spacesTable)
          .where(inArray(spacesTable.id, selectedSpaceIds))
      : []

    const spaceOrderMap = new Map(
      selectedSpaceIds.map((id, index) => [id, index])
    )
    spaces.sort(
      (a, b) => (spaceOrderMap.get(a.id) ?? 0) - (spaceOrderMap.get(b.id) ?? 0)
    )

    // 3) Load documents for selected spaces
    const spaceIds = spaces.map((s) => s.id)
    const docs = spaceIds.length
      ? await db
          .select()
          .from(documentsTable)
          .where(inArray(documentsTable.spaceId, spaceIds))
          .orderBy(asc(documentsTable.rank))
      : []

    // Index by space and parent; sort by (parentId, rank, slug)
    const bySpace = new Map<string, typeof docs>()
    for (const s of spaces) bySpace.set(s.id, [])
    for (const d of docs) {
      if (!bySpace.has(d.spaceId)) bySpace.set(d.spaceId, [])
      bySpace.get(d.spaceId)!.push(d)
    }

    const docsById = new Map(docs.map((d) => [d.id, d]))
    const childrenOf = new Map<string, string[]>()
    for (const d of docs) {
      const pid = d.parentId ?? "__root__:" + d.spaceId
      if (!childrenOf.has(pid)) childrenOf.set(pid, [])
      childrenOf.get(pid)!.push(d.id)
    }
    function routeFor(spaceSlug: string, trail: string[], isApi: boolean) {
      if (isApi) {
        return `/api-reference/${spaceSlug}/${trail.join("/")}`
      }
      return `/${spaceSlug}/${trail.join("/")}`
    }

    // 4) Flatten pages and compute routes per space
    type FlatPage = {
      id: string
      title: string
      slug: string
      trail: string[]
      spaceId: string
      spaceSlug: string
      iconName?: string | null
      updatedAt?: Date | null
      type: "page" | "group" | "api" | "api_spec" | "api_tag"
      apiSpecBlobKey?: string | null
      apiPath?: string | null
      apiMethod?: string | null
    }
    const flatPages: FlatPage[] = []
    const routesBySpace = new Map<string, string[]>()

    for (const s of spaces) {
      const rootKey = "__root__:" + s.id
      const spaceSlug = s.slug
      const walk = (id: string, trail: string[]) => {
        const doc = docsById.get(id)!
        const nextTrail = trail.concat(doc.slug)
        if (doc.type === "page" || doc.type === "api") {
          const r = routeFor(spaceSlug, nextTrail, doc.type === "api")
          flatPages.push({
            id: doc.id,
            title: doc.title,
            slug: doc.slug,
            trail: nextTrail,
            spaceId: s.id,
            spaceSlug,
            iconName: doc.iconName ?? null,
            updatedAt: doc.updatedAt,
            type: doc.type,
            apiSpecBlobKey: doc.apiSpecBlobKey ?? null,
            apiPath: doc.apiPath ?? null,
            apiMethod: doc.apiMethod ?? null,
          })
          if (!routesBySpace.has(spaceSlug)) routesBySpace.set(spaceSlug, [])
          routesBySpace.get(spaceSlug)!.push(r)
        }
        const kids = childrenOf.get(id) ?? []
        for (const kid of kids) walk(kid, nextTrail)
      }
      const tops = childrenOf.get(rootKey) ?? []
      for (const tid of tops) walk(tid, [])
    }

    // Initialize totals
    await db
      .update(siteBuildsTable)
      .set({ itemsTotal: flatPages.length })
      .where(eq(siteBuildsTable.id, build.id))

    // 5) Render + upload page bundles as content-addressed blobs per org
    const pageRefById = new Map<
      string,
      { key: string; hash: string; size: number }
    >()
    let itemsDone = 0
    let pagesWritten = 0
    let bytesWritten = 0
    const orgId = site.organizationId

    type PageBundle = {
      id: string
      title: string
      slug: string
      trail: string[]
      iconName?: string | null
      updatedAt?: Date | null
      type: "page" | "api" | "api_spec" | "group" | "api_tag"
      apiSpecBlobKey?: string | null
      apiPath?: string | null
      apiMethod?: string | null
      rendered?: { html: string; toc: TocItem[] }
      plain?: string
      markdown?: string
      source?: JSONContent
    }
    const docMetadata = new Map<string, { headings: string[]; plain: string }>()

    for (const p of flatPages) {
      const bundleObj: PageBundle = {
        id: p.id,
        title: p.title,
        slug: p.slug,
        trail: p.trail,
        iconName: p.iconName,
        updatedAt: p.updatedAt,
        type: p.type,
      }
      // --- REAL CONTENT LOADING STARTS HERE ---
      if (p.type === "api" || p.type === "api_spec" || p.type === "api_tag") {
        bundleObj.apiPath = p.apiPath
        bundleObj.apiMethod = p.apiMethod
        bundleObj.apiSpecBlobKey = p.apiSpecBlobKey
        bundleObj.rendered = { html: "", toc: [] }
        bundleObj.plain = ""
        bundleObj.source = { type: "api", content: [] }
      } else {
        let pmDoc: JSONContent | null = null
        try {
          pmDoc = await loadPmJsonFromYUpdates(p.id)
        } catch (e) {
          // If a doc has no updates or decode fails, fall back to empty doc
          console.log("Failed to load PM JSON for doc", p.id, e)
          pmDoc = { type: "doc", content: [] }
        }
        const { html, toc } = await serializeContent(pmDoc)
        const plain = extractPlain(pmDoc)
        bundleObj.rendered = { html, toc }
        bundleObj.plain = plain
        bundleObj.markdown = toMarkdown(pmDoc)
        bundleObj.source = pmDoc ?? {}
        docMetadata.set(p.id, { headings: toc.map((t) => t.text), plain })
      }

      const body = JSON.stringify(bundleObj)
      const hash = sha256(body)
      const key = `orgs/${orgId}/blobs/${hash}.json`
      const size = byteLengthUtf8(body)

      // Dedup by orgId + hash
      const existing = (
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

      if (!existing) {
        await writeBlobImmutable(key, body)
        await db.insert(siteContentBlobsTable).values({
          organizationId: orgId,
          hash,
          key,
          size,
        })
        pagesWritten += 1
        bytesWritten += size
      }

      pageRefById.set(p.id, { key, hash, size })
      itemsDone += 1

      await db
        .update(siteBuildsTable)
        .set({ itemsDone, pagesWritten, bytesWritten })
        .where(eq(siteBuildsTable.id, build.id))
    }

    // 6) Build manifest and tree (with UI tree like the old worker)
    const now = Date.now()
    const siteLayout = site.layout === "tabs" ? "tabs" : "sidebar-dropdown"
    const navSpaces: NavSpace[] = spaces.map((s, i) => ({
      slug: s.slug,
      name: s.name,
      style: siteLayout === "tabs" ? "tab" : "dropdown",
      order: i + 1,
      iconName: s.iconName ?? null,
      entry: (routesBySpace.get(s.slug) ?? [])[0],
    }))

    const pagesIndex: Record<string, PageIndexEntry> = {}
    for (const p of flatPages) {
      const r = routeFor(p.spaceSlug, p.trail, p.type === "api")
      const ref = pageRefById.get(p.id)!
      pagesIndex[r] = {
        title: p.title,
        space: p.spaceSlug,
        iconName: p.iconName ?? null,
        blob: ref.key,
        hash: ref.hash,
        size: ref.size,
        lastModified: p.updatedAt ? p.updatedAt.getTime() : now,
        kind: p.type === "api" ? "api" : "page",
      }
      if (p.type === "api" && p.apiPath && p.apiMethod && p.apiSpecBlobKey) {
        pagesIndex[r].api = {
          path: p.apiPath,
          method: p.apiMethod,
          document: p.apiSpecBlobKey,
        }
      }
    }
    for (const spaceSlug of routesBySpace.keys()) {
      const routes = routesBySpace.get(spaceSlug) ?? []
      for (let i = 0; i < routes.length; i++) {
        const currentRoute = routes[i]!
        const prevRoute = routes[i - 1]
        const nextRoute = routes[i + 1]

        const currentPage = pagesIndex[currentRoute]
        if (currentPage) {
          const prevPage = prevRoute ? pagesIndex[prevRoute] : null
          if (prevPage) {
            currentPage.previous = {
              title: prevPage.title,
              route: prevRoute!,
            }
          }

          const nextPage = nextRoute ? pagesIndex[nextRoute] : null
          if (nextPage) {
            currentPage.next = {
              title: nextPage.title,
              route: nextRoute!,
            }
          }
        }
      }
    }

    // Build UI-friendly tree (spaces -> items with routes)
    type UiTreeItem = {
      kind: "group" | "page" | "api" | "api_spec" | "api_tag"
      title: string
      iconName?: string | null
      slug: string
      route: string
      api?: {
        path: string
        method: string
        document: string
      }
      children?: UiTreeItem[]
    }
    type UiTreeSpace = {
      space: { slug: string; name: string; iconName?: string | null }
      items: UiTreeItem[]
    }
    const uiTreeSpaces: UiTreeSpace[] = spaces.map((s) => {
      const spaceSlug = s.slug
      const asUi = (
        id: string,
        trail: string[],
        isApi: boolean
      ): UiTreeItem => {
        const d = docsById.get(id)!
        const route = routeFor(spaceSlug, trail.concat(d.slug), isApi)
        let kind: UiTreeItem["kind"]
        if (d.type === "api") {
          kind = "api"
        } else if (d.type === "api_spec") {
          kind = "api_spec"
        } else if (d.type === "api_tag") {
          kind = "api_tag"
        } else {
          kind = d.type === "group" ? "group" : "page"
        }
        const base: UiTreeItem = {
          kind,
          title: d.title,
          iconName: d.iconName ?? null,
          slug: d.slug,
          route,
        }
        if (kind === "api") {
          base.api = {
            path: d.apiPath!,
            method: d.apiMethod!,
            document: d.apiSpecBlobKey!,
          }
        }
        const kids = (childrenOf.get(id) ?? []).map((k) => {
          const childDoc = docsById.get(k)!
          return asUi(k, trail.concat(d.slug), childDoc.type === "api")
        })
        return kids.length ? { ...base, children: kids } : base
      }
      const rootKey = "__root__:" + s.id
      const roots = (childrenOf.get(rootKey) ?? []).map((id) => {
        const childDoc = docsById.get(id)!
        return asUi(id, [], childDoc.type === "api")
      })
      return {
        space: { slug: s.slug, name: s.name, iconName: s.iconName ?? null },
        items: roots,
      }
    })

    const manifest = {
      version: 3,
      contentVersion: "pm-bundle-v2",
      buildId,
      publishedAt: now,
      site: {
        name: null,
        // Back-compat: keep logoUrl, prefer light logo
        logoUrl: site.logoUrlLight ?? null,
        layout: siteLayout,
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
        defaultSpace: navSpaces[0]?.slug ?? spaces[0]?.slug ?? "docs",
      },
      nav: { spaces: navSpaces },
      counts: {
        pages: flatPages.length,
        newBlobs: pagesWritten,
        reusedBlobs: flatPages.length - pagesWritten,
      },
      pages: pagesIndex,
    }

    const tree = {
      version: 2,
      siteId,
      buildId,
      publishedAt: now,
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
            iconName?: string | null
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
            iconName: b.iconName ?? null,
            target: b.target ?? "_self",
            slug: b.slug ?? null,
          })
        }
        return empty
      })(),
    }

    // 6.5) Write theme.json (MVP: tokens + shiki)
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

    // 7) Upload versioned files and pointers
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

    // Mirror pointer for primary and custom domains
    const customDomains = await db
      .select()
      .from(siteDomainsTable)
      .where(eq(siteDomainsTable.siteId, siteId))
    await writeDomainPointers(
      [site.primaryHost, ...customDomains.map((d) => d.domain)],
      { buildId, manifestUrl, treeUrl, themeUrl }
    )

    const pagesForIndex = flatPages.map((p) => {
      const meta = docMetadata.get(p.id)
      return {
        id: p.id,
        spaceSlug: p.spaceSlug,
        route: routeFor(p.spaceSlug, p.trail, p.type === "api"),
        title: p.title,
        kind: p.type === "api" ? "api" : ("page" as "api" | "page"),
        headings: meta?.headings ?? [],
        apiPath: p.apiPath ?? null,
        apiMethod: p.apiMethod ?? null,
        plain: meta?.plain ?? "",
        updatedAt: p.updatedAt ? p.updatedAt.getTime() : now,
      }
    })

    await indexDocsInTypesense({ siteId, buildId, pages: pagesForIndex })

    // 8) Finalize build
    await db
      .update(sitesTable)
      .set({ lastBuildId: buildId, lastPublishedAt: new Date() })
      .where(eq(sitesTable.id, siteId))
    await db
      .update(siteBuildsTable)
      .set({ status: "success", finishedAt: new Date() })
      .where(eq(siteBuildsTable.id, build.id))

    return { ok: true, buildId }
  }
)
