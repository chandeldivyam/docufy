// apps/web/src/inngest/functions/domain-connect.ts
import { inngest } from "../client"
import { db } from "@/db/connection"
import { sitesTable } from "@/db/schema"
import { eq } from "drizzle-orm"
import { connectDomainOnVercel } from "../helpers/domains"
import { writeDomainPointers } from "../helpers/blob"

export const domainConnect = inngest.createFunction(
  { id: "domain-connect" },
  { event: "domain/connect" },
  async ({ event }) => {
    const { siteId, domain } = event.data as { siteId: string; domain: string }
    const [site] = await db
      .select()
      .from(sitesTable)
      .where(eq(sitesTable.id, siteId))
      .limit(1)
    if (!site) throw new Error("Site not found")

    await connectDomainOnVercel(domain)

    // Mirror pointer to the new domain if site has a build
    if (site.lastBuildId) {
      const manifestUrl = `${site.baseUrl}/sites/${siteId}/${site.lastBuildId}/manifest.json`
      const treeUrl = `${site.baseUrl}/sites/${siteId}/${site.lastBuildId}/tree.json`
      await writeDomainPointers([domain], {
        buildId: site.lastBuildId,
        manifestUrl,
        treeUrl,
      })
    }

    return { domain, verified: false }
  }
)
