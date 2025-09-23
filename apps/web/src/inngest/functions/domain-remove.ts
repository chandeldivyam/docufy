// apps/web/src/inngest/functions/domain-remove.ts
import { inngest } from "../client"
import { removeDomainOnVercel } from "../helpers/domains"

export const domainRemove = inngest.createFunction(
  { id: "domain-remove" },
  { event: "domain/remove" },
  async ({ event }) => {
    const { domain } = event.data as { domain: string }
    try {
      await removeDomainOnVercel(domain)
    } catch {
      console.error("Failed to remove domain on Vercel")
    }
    return { removed: domain }
  }
)
