// apps/web/src/inngest/helpers/hash.ts
import { createHash } from "node:crypto"
export const sha256: (s: string) => string = (s: string) =>
  createHash("sha256").update(s).digest("hex")
export const byteLengthUtf8: (s: string) => number = (s: string) =>
  Buffer.byteLength(s, "utf8")
