// apps/web/src/inngest/helpers/domains.ts
const VERCEL_TOKEN = process.env.VERCEL_TOKEN
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID
const VERCEL_RENDERER_PROJECT = process.env.VERCEL_RENDERER_PROJECT // id or slug

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

export async function connectDomainOnVercel(domain: string) {
  if (!VERCEL_RENDERER_PROJECT)
    throw new Error("VERCEL_RENDERER_PROJECT not set")
  const add = await vfetch(
    `/v10/projects/${encodeURIComponent(VERCEL_RENDERER_PROJECT)}/domains`,
    {
      method: "POST",
      body: JSON.stringify({ name: domain }),
    }
  )
  if (!add.ok) throw new Error(`Vercel add domain failed: ${await add.text()}`)
  // best effort verify kick
  try {
    await vfetch(
      `/v10/projects/${encodeURIComponent(VERCEL_RENDERER_PROJECT)}/domains/${encodeURIComponent(domain)}/verify`,
      { method: "POST" }
    )
  } catch {
    console.log("Failed to verify domain on Vercel")
  }
}

export async function removeDomainOnVercel(domain: string) {
  if (!VERCEL_RENDERER_PROJECT)
    throw new Error("VERCEL_RENDERER_PROJECT not set")
  await vfetch(
    `/v10/projects/${encodeURIComponent(VERCEL_RENDERER_PROJECT)}/domains/${encodeURIComponent(domain)}`,
    { method: "DELETE" }
  )
}

export async function verifyDomainOnVercel(domain: string) {
  if (!VERCEL_RENDERER_PROJECT)
    throw new Error("VERCEL_RENDERER_PROJECT not set")
  // trigger verify
  await vfetch(
    `/v10/projects/${encodeURIComponent(VERCEL_RENDERER_PROJECT)}/domains/${encodeURIComponent(domain)}/verify`,
    { method: "POST" }
  )
  // read status
  const statusRes = await vfetch(
    `/v10/projects/${encodeURIComponent(VERCEL_RENDERER_PROJECT)}/domains/${encodeURIComponent(domain)}`
  )
  const json = statusRes.ok ? await statusRes.json().catch(() => ({})) : {}
  return json
}
