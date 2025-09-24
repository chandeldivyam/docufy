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

    const { projectDomain, dns, ready } = await verifyDomainOnVercel(domain)

    await db
      .update(siteDomainsTable)
      .set({
        verified: ready,
        lastCheckedAt: new Date(),
      })
      .where(eq(siteDomainsTable.domain, domain))

    return {
      domain,
      verified: ready,
      status: {
        projectDomain,
        dns,
      },
    }
  }
)
