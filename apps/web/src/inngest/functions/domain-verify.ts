// apps/web/src/inngest/functions/domain-verify.ts
import { inngest } from "../client"
import { db } from "@/db/connection"
import { siteDomainsTable } from "@/db/schema"
import { eq } from "drizzle-orm"
import { verifyDomainOnVercel } from "../helpers/domains"

export const domainVerify = inngest.createFunction(
  { id: "domain-verify" },
  { event: "domain/verify" },
  async ({ event }) => {
    const { domain } = event.data as { domain: string }
    const status = await verifyDomainOnVercel(domain)
    const verified = Boolean(status?.verified || status?.configured)
    await db
      .update(siteDomainsTable)
      .set({
        verified,
        lastCheckedAt: new Date(),
      })
      .where(eq(siteDomainsTable.domain, domain))
    return { domain, verified, status }
  }
)
