// apps/web/src/lib/rank.ts
// Variable-length base36 fractional indexing for stable lexicographic order.

const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz"
const MIN = 0
const MAX = DIGITS.length - 1

const toInt = (ch: string) => {
  const i = DIGITS.indexOf(ch)
  if (i === -1) throw new Error(`Invalid rank char: ${ch}`)
  return i
}
const toChar = (n: number) => DIGITS[n]

/**
 * Returns a string that is lexicographically strictly between a and b.
 * a === null means -∞, b === null means +∞.
 */
export function rankBetween(a: string | null, b: string | null): string {
  if (a === null && b === null) return "u" // mid of our alphabet
  let i = 0
  let out = ""
  while (true) {
    const aDigit = a && i < a.length ? toInt(a[i]!) : MIN
    const bDigit = b && i < b.length ? toInt(b[i]!) : MAX

    if (aDigit === bDigit) {
      out += toChar(aDigit)
      i++
      continue
    }
    if (aDigit + 1 < bDigit) {
      const mid = Math.floor((aDigit + bDigit) / 2)
      return out + toChar(mid)
    }
    // no room at this position; keep a's digit and go deeper
    out += toChar(aDigit)
    i++
  }
}

export const rankBefore = (b: string | null) => rankBetween(null, b)
export const rankAfter = (a: string | null) => rankBetween(a, null)
export const compareRank = (a: string, b: string) =>
  a < b ? -1 : a > b ? 1 : 0
