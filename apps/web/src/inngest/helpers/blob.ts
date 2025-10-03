// apps/web/src/inngest/helpers/blob.ts
import { put } from "@vercel/blob"

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN

export async function blobPut(
  key: string,
  content: string,
  contentType: string,
  opts?: { immutable?: boolean; overwrite?: boolean }
) {
  if (!TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN missing")
  return put(key, content, {
    access: "public",
    contentType,
    cacheControlMaxAge: opts?.immutable ? 31536000 : 0,
    addRandomSuffix: false,
    allowOverwrite: opts?.overwrite ?? false,
    token: TOKEN, // required on server
  })
}

export async function writeVersioned(
  siteId: string,
  buildId: string,
  key: "manifest.json" | "tree.json" | "theme.json",
  content: string
) {
  return blobPut(
    `sites/${siteId}/${buildId}/${key}`,
    content,
    "application/json",
    { immutable: true }
  )
}

export async function writeLatestPointer(
  siteId: string,
  payload: {
    buildId: string
    treeUrl: string
    manifestUrl: string
    themeUrl?: string
  }
) {
  return blobPut(
    `sites/${siteId}/latest.json`,
    JSON.stringify(payload),
    "application/json",
    { overwrite: true }
  )
}

export async function writeDomainPointers(
  hosts: Array<string | null | undefined>,
  payload: {
    buildId: string
    treeUrl: string
    manifestUrl: string
    themeUrl?: string
  }
) {
  for (const h of hosts ?? []) {
    const host = h?.toLowerCase().split(":")[0]
    if (!host) continue
    await blobPut(
      `domains/${host}/latest.json`,
      JSON.stringify(payload),
      "application/json",
      { overwrite: true }
    )
  }
}
