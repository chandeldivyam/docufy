// apps/web/src/lib/presence.ts
export function displayNameFrom(user?: {
  name?: string | null
  email?: string | null
}) {
  if (user?.name && user.name.trim()) return user.name.trim()
  if (user?.email) return user.email.split("@")[0]
  return "Anonymous"
}

// Deterministic, readable color based on a string seed (id/email)
export function colorFromString(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++)
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  const h = Math.abs(hash) % 360,
    s = 65,
    l = 55
  return hslToHex(h, s, l)
}

function hslToHex(h: number, s: number, l: number) {
  s /= 100
  l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x]
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export type PresenceUser = {
  id: string
  name: string
  email?: string | null
  image?: string | null
  color: string
}
