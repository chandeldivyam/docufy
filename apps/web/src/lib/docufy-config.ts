import path from "node:path"
import { z } from "zod"

const LayoutZ = z.enum(["sidebar-dropdown", "tabs"])
export const ButtonPositionZ = z.enum([
  "sidebar_top",
  "sidebar_bottom",
  "topbar_left",
  "topbar_right",
])
const ButtonZ = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
  position: ButtonPositionZ.default("sidebar_top"),
  icon: z.string().nullable().optional(),
  target: z.enum(["_self", "_blank"]).default("_self"),
  rank: z.number().int().nonnegative().optional(),
})

const ThemeZ = z
  .object({
    version: z.number().int().min(1).default(1),
    light: z.record(z.string()).default({}),
    dark: z.record(z.string()).default({}),
    vars: z.record(z.string()).default({}),
  })
  .default({})

export const DocufyConfigV1Z = z
  .object({
    version: z.literal(1).default(1),
    site: z
      .object({
        name: z.string().min(1).default("Documentation"),
        layout: LayoutZ.default("sidebar-dropdown"),
      })
      .default({}),
    branding: z
      .object({
        logo: z
          .object({
            light: z.string().min(1).optional(),
            dark: z.string().min(1).optional(),
          })
          .default({}),
        favicon: z.string().min(1).optional(),
      })
      .default({}),
    theme: ThemeZ,
    navigation: z
      .object({
        buttons: z.array(ButtonZ).default([]),
      })
      .default({}),
    assets: z
      .object({
        basePath: z.string().min(1).optional(),
      })
      .optional(),
  })
  .strict()

export type DocufyConfigV1 = z.infer<typeof DocufyConfigV1Z>

export type NormalizedDocufyConfig = {
  version: 1
  site: { name: string; layout: z.infer<typeof LayoutZ> }
  branding: {
    logo: { light?: string; dark?: string }
    favicon?: string
  }
  theme: {
    version: number
    light: Record<string, string>
    dark: Record<string, string>
    vars: Record<string, string>
  }
  navigation: {
    buttons: Array<
      z.infer<typeof ButtonZ> & {
        rank: number
      }
    >
  }
  assets?: { basePath?: string }
}

function isExternalUrl(val?: string | null) {
  if (!val) return false
  return /^https?:\/\//i.test(val) || val.startsWith("data:")
}

function resolveAssetPath(
  value: string | undefined,
  configDir: string
): string | undefined {
  if (!value) return undefined
  if (isExternalUrl(value)) return value
  if (value.startsWith("/")) return value // allow repo-root absolute
  return path.posix.join(configDir || ".", value)
}

export function normalizeDocufyConfig(
  raw: DocufyConfigV1,
  opts: { configDir?: string } = {}
): NormalizedDocufyConfig {
  const configDir = opts.configDir ?? "."
  const rankNormalizedButtons = (raw.navigation?.buttons ?? []).map(
    (btn, idx) => ({
      ...btn,
      rank: btn.rank ?? idx,
    })
  )

  return {
    version: 1,
    site: {
      name: raw.site?.name ?? "Documentation",
      layout: raw.site?.layout ?? "sidebar-dropdown",
    },
    branding: {
      logo: {
        light: resolveAssetPath(raw.branding?.logo?.light, configDir),
        dark: resolveAssetPath(raw.branding?.logo?.dark, configDir),
      },
      favicon: resolveAssetPath(raw.branding?.favicon, configDir),
    },
    theme: {
      version: raw.theme?.version ?? 1,
      light: raw.theme?.light ?? {},
      dark: raw.theme?.dark ?? {},
      vars: raw.theme?.vars ?? {},
    },
    navigation: {
      buttons: rankNormalizedButtons,
    },
    assets: raw.assets ?? {},
  }
}

export function parseDocufyConfig(input: string) {
  const obj = JSON.parse(input)
  return DocufyConfigV1Z.parse(obj)
}

export function validateDocufyConfig(
  input: string,
  opts: { configDir?: string } = {}
):
  | { ok: true; config: NormalizedDocufyConfig }
  | { ok: false; error: string; issues: string[] } {
  try {
    const parsed = parseDocufyConfig(input)
    const normalized = normalizeDocufyConfig(parsed, opts)
    return { ok: true, config: normalized }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return {
        ok: false,
        error: "Config validation failed",
        issues: err.issues.map((i) => i.message),
      }
    }
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Unknown error while validating",
      issues: [],
    }
  }
}
