import { upload } from "@vercel/blob/client"

export type BlobUploadContext = {
  orgSlug?: string
  documentId: string
}

export type BlobUploadResult = {
  url: string
  width?: number
  height?: number
}

const FALLBACK_NAME = "image"
const ORG_PLACEHOLDER = "no-org"

function sanitizeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_")
}

async function measureImage(file: File): Promise<{
  width?: number
  height?: number
}> {
  if (!file.type.startsWith("image/")) return {}

  const objectUrl = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = "async"
    img.src = objectUrl

    const dims = await new Promise<{ width: number; height: number }>(
      (resolve, reject) => {
        img.onload = () =>
          resolve({ width: img.naturalWidth, height: img.naturalHeight })
        img.onerror = () =>
          reject(new Error("Failed to load image for measurement"))
      }
    )

    return dims
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function uploadImageToBlob(
  file: File,
  ctx: BlobUploadContext
): Promise<BlobUploadResult> {
  const uuid = crypto.randomUUID()
  const safeName = sanitizeName(file.name || FALLBACK_NAME)
  const orgSegment = ctx.orgSlug ? ctx.orgSlug : ORG_PLACEHOLDER
  const pathname = `assets/${orgSegment}/${ctx.documentId}/${uuid}-${safeName}`

  const result = await upload(pathname, file, {
    access: "public",
    handleUploadUrl: "/api/blob/upload",
    clientPayload: JSON.stringify({
      documentId: ctx.documentId,
      orgSlug: ctx.orgSlug,
    }),
  })

  const dimensions = await measureImage(file)

  return {
    url: result.url,
    ...dimensions,
  }
}
