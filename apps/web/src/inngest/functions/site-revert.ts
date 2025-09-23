// apps/web/src/inngest/functions/site-revert.ts
import { inngest } from "../client"
import { db } from "@/db/connection"
import { sitesTable, siteBuildsTable, siteDomainsTable } from "@/db/schema"
import { eq } from "drizzle-orm"
import {
  writeVersioned,
  writeLatestPointer,
  writeDomainPointers,
} from "../helpers/blob"

export const siteRevert = inngest.createFunction(
  { id: "site-revert" },
  { event: "site/revert" }, // name we will send from TRPC
  async ({ event }) => {
    const { siteId, buildId, targetBuildId } = event.data as {
      siteId: string
      buildId: string
      targetBuildId: string
    }
    const [site] = await db
      .select()
      .from(sitesTable)
      .where(eq(sitesTable.id, siteId))
      .limit(1)
    if (!site) throw new Error("Site not found")

    const base = site.baseUrl
    const manifestRes = await fetch(
      `${base}/sites/${siteId}/${targetBuildId}/manifest.json`
    )
    const treeRes = await fetch(
      `${base}/sites/${siteId}/${targetBuildId}/tree.json`
    )
    if (!manifestRes.ok || !treeRes.ok)
      throw new Error("Target build assets missing")

    const now = Date.now()
    const sourceManifest = await manifestRes.json()
    const sourceTree = await treeRes.json()

    const aliasedManifest = {
      ...sourceManifest,
      buildId,
      publishedAt: now,
      aliasedFromBuildId: targetBuildId,
    }
    const aliasedTree = { ...sourceTree, buildId, publishedAt: now }

    await writeVersioned(
      siteId,
      buildId,
      "manifest.json",
      JSON.stringify(aliasedManifest)
    )
    await writeVersioned(
      siteId,
      buildId,
      "tree.json",
      JSON.stringify(aliasedTree)
    )

    const manifestUrl = `${base}/sites/${siteId}/${buildId}/manifest.json`
    const treeUrl = `${base}/sites/${siteId}/${buildId}/tree.json`

    await writeLatestPointer(siteId, { buildId, manifestUrl, treeUrl })

    const customDomains = await db
      .select()
      .from(siteDomainsTable)
      .where(eq(siteDomainsTable.siteId, siteId))
    await writeDomainPointers(
      [site.primaryHost, ...customDomains.map((d) => d.domain)],
      { buildId, manifestUrl, treeUrl }
    )

    await db
      .update(sitesTable)
      .set({ lastBuildId: buildId, lastPublishedAt: new Date() })
      .where(eq(sitesTable.id, siteId))
    await db
      .update(siteBuildsTable)
      .set({ status: "success", finishedAt: new Date() })
  }
)
