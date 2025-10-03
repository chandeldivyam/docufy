// apps/web/src/theme/color.ts
import { converter, formatHex } from "culori"
import type { Oklch as OklchColor } from "culori"

// Parse "oklch(L C H)" -> HEX (#rrggbb). Null if not parseable.
export function oklchToHexOrNull(v: string): string | null {
  const m = v.trim().match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/i)
  if (!m) return null
  const L = parseFloat(m[1]!),
    C = parseFloat(m[2]!),
    H = parseFloat(m[3]!)

  // Build a proper culori color object with mode
  const col: OklchColor = { mode: "oklch", l: L, c: C, h: H }

  // formatHex will clamp/convert to sRGB hex
  const hex = formatHex(col)
  return hex ?? null
}

// Parse HEX -> OKLCH string "oklch(L C H)". Null if invalid.
export function hexToOklchOrNull(hex: string): string | null {
  const v = hex.trim()
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return null

  const toOklch = converter("oklch") // returns a function
  const col = toOklch(v) as OklchColor | undefined
  if (!col || col.mode !== "oklch") return null

  const L = Number((col.l ?? 0).toFixed(3))
  const C = Number((col.c ?? 0).toFixed(3))
  const H = Number((col.h ?? 0).toFixed(1))
  return `oklch(${L} ${C} ${H})`
}

// Is this an absolute color literal (oklch(...) or #hex)?
export function isAbsoluteColor(s: string): boolean {
  const v = s.trim()
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) || /^oklch\(/i.test(v)
}

// Provide a safe value for <input type="color"> and whether it should be enabled
export function computePickerValue(value: string): {
  hex: string
  enabled: boolean
} {
  const v = value?.trim() || ""
  if (!isAbsoluteColor(v)) return { hex: "#000000", enabled: false } // color-mix()/var() etc → disabled
  if (v.startsWith("#")) return { hex: v, enabled: true }
  const hex = oklchToHexOrNull(v) ?? "#000000"
  return { hex, enabled: true }
}
