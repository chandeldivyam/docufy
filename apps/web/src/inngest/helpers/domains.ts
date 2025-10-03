// apps/web/src/inngest/helpers/domains.ts
const VERCEL_TOKEN = process.env.VERCEL_TOKEN
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID
const VERCEL_RENDERER_PROJECT = process.env.VERCEL_RENDERER_PROJECT

function vurl(path: string) {
  const u = new URL(`https://api.vercel.com${path}`)
  if (VERCEL_TEAM_ID) u.searchParams.set("teamId", VERCEL_TEAM_ID)
  return u.toString()
}

async function vfetch(path: string, init?: RequestInit) {
  if (!VERCEL_TOKEN) throw new Error("VERCEL_TOKEN not configured")
  const res = await fetch(vurl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  })
  return res
}

// Helper to fetch an absolute URL with auth (for complex query params)
async function vfetchAbs(u: URL, init?: RequestInit) {
  if (!VERCEL_TOKEN) throw new Error("VERCEL_TOKEN not configured")
  const res = await fetch(u.toString(), {
    ...init,
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  })
  return res
}

export async function connectDomainOnVercel(domain: string) {
  if (!VERCEL_RENDERER_PROJECT)
    throw new Error("VERCEL_RENDERER_PROJECT not set")
  const add = await vfetch(
    `/v10/projects/${encodeURIComponent(VERCEL_RENDERER_PROJECT)}/domains`,
    { method: "POST", body: JSON.stringify({ name: domain }) }
  )
  if (!add.ok) {
    const add_response = await add.json()
    throw new Error(`Vercel add domain failed: ${add_response.error.code}`)
  }
  // Kick project-domain verification (ownership challenge), not DNS
  const verify = await vfetch(
    `/v10/projects/${encodeURIComponent(VERCEL_RENDERER_PROJECT)}/domains/${encodeURIComponent(domain)}/verify`,
    { method: "POST" }
  )
  if (!verify.ok)
    throw new Error(
      `Failed to verify project-domain: ${await verify.json().then((j) => j.message)}`
    )
}

// Query Vercel's Domain Config API (authoritative DNS readiness signal)
export async function getDomainConfigFromVercel(domain: string) {
  if (!VERCEL_RENDERER_PROJECT)
    throw new Error("VERCEL_RENDERER_PROJECT not set")

  const u = new URL(
    `https://api.vercel.com/v6/domains/${encodeURIComponent(domain)}/config`
  )
  if (VERCEL_TEAM_ID) u.searchParams.set("teamId", VERCEL_TEAM_ID)
  u.searchParams.set("projectIdOrName", VERCEL_RENDERER_PROJECT)

  const res = await vfetchAbs(u)
  return res.ok ? await res.json() : null
}

// Lightweight DNS-over-HTTPS lookup via Cloudflare
async function doh(name: string, type: "A" | "CNAME"): Promise<string[]> {
  const url = new URL("https://cloudflare-dns.com/dns-query")
  url.searchParams.set("name", name)
  url.searchParams.set("type", type)
  const r = await fetch(url.toString(), {
    headers: { accept: "application/dns-json" },
  })
  if (!r.ok) return []
  const j = await r.json().catch(() => ({}))
  const ans: Array<{ data?: string }> = Array.isArray(j.Answer) ? j.Answer : []
  return ans
    .map((a) => a.data ?? "")
    .filter(Boolean)
    .map((s) => s.replace(/\.$/, "").toLowerCase())
}

function normHost(h: string) {
  return h.replace(/\.$/, "").toLowerCase()
}

// Validate DNS points to Vercel using either CNAME (subdomain) or A (apex)
export async function dnsPointsToVercel(domain: string) {
  const recommendedCNAME = new Set([
    "cname.vercel-dns.com",
    "cname.vercel-dns.com.",
  ])

  // Try CNAME first
  const cnames = await doh(domain, "CNAME")

  if (cnames.length) {
    const ok = cnames.some((c) => recommendedCNAME.has(normHost(c)))
    return { method: "CNAME", ok, answers: cnames }
  }

  return { method: "CNAME", ok: false, answers: [] }
}

export async function verifyDomainOnVercel(domain: string) {
  if (!VERCEL_RENDERER_PROJECT)
    throw new Error("VERCEL_RENDERER_PROJECT not set")

  // Project-domain object (ownership)
  const pdRes = await vfetch(
    `/v10/projects/${encodeURIComponent(VERCEL_RENDERER_PROJECT)}/domains/${encodeURIComponent(domain)}`
  )
  const projectDomain = pdRes.ok ? await pdRes.json().catch(() => ({})) : {}

  // DNS readiness
  const dns = await dnsPointsToVercel(domain)

  // Ready only if project-domain is verified AND DNS is correctly configured
  const ready =
    Boolean(projectDomain && projectDomain.verified) && Boolean(dns.ok)

  return { projectDomain, dns, ready }
}

export async function removeDomainOnVercel(domain: string) {
  if (!VERCEL_RENDERER_PROJECT)
    throw new Error("VERCEL_RENDERER_PROJECT not set")
  await vfetch(
    `/v10/projects/${encodeURIComponent(VERCEL_RENDERER_PROJECT)}/domains/${encodeURIComponent(domain)}`,
    { method: "DELETE" }
  )
}
