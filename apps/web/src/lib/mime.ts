const mimeMap: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".gif": "image/gif",
}

export function mimeFromFilename(filename: string): string {
  const lower = filename.toLowerCase()
  const ext = Object.keys(mimeMap).find((k) => lower.endsWith(k))
  return ext
    ? (mimeMap[ext] ?? "application/octet-stream")
    : "application/octet-stream"
}
