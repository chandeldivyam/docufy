import path from "node:path"
import { z } from "zod"

const LayoutZ = z.enum(["sidebar-dropdown", "tabs"])
export const ButtonPositionZ = z.enum([
  "sidebar_top",
  "sidebar_bottom",
  "topbar_left",
  "topbar_right",
])
const DocTypeZ = z.enum(["page", "group", "api"])
const ButtonZ = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
  position: ButtonPositionZ.default("sidebar_top"),
  icon: z.string().nullable().optional(),
  target: z.enum(["_self", "_blank"]).default("_self"),
  rank: z.number().int().nonnegative().optional(),
})

export type NavNode = {
  title: string
  path?: string
  icon?: string | null
  type?: "page" | "group" | "api"
  children?: NavNode[]
}

const NavNodeZ: z.ZodType<NavNode> = z.lazy(() =>
  z.object({
    title: z.string().min(1),
    path: z.string().min(1).optional(),
    icon: z.string().nullable().optional(),
    type: DocTypeZ.optional(),
    children: z.array(NavNodeZ).optional(),
  })
)

const SpaceZ = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  style: LayoutZ.optional(),
  // Defaults to the config directory so users can make all paths relative to the config file
  rootDir: z.string().min(1).default("."),
  entry: z.string().min(1).optional(),
  tree: z.array(NavNodeZ).default([]),
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
        spaces: z.array(SpaceZ).default([]),
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
    spaces: Array<{
      slug: string
      name: string
      style: z.infer<typeof LayoutZ>
      rootDir: string
      entry?: string
      tree: NormalizedNavNode[]
    }>
  }
  assets?: { basePath?: string }
}

export type NormalizedNavNode = {
  title: string
  path?: string
  icon?: string | null
  type: z.infer<typeof DocTypeZ>
  children?: NormalizedNavNode[]
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
  // Treat leading slash as "relative to configDir" for user-friendliness
  if (value.startsWith("/")) return path.posix.join(configDir || ".", value)
  return path.posix.join(configDir || ".", value)
}

function normalizeNavNode(node: NavNode, configDir: string): NormalizedNavNode {
  const resolvedPath = resolveAssetPath(node.path, configDir)
  const children = (node.children ?? []).map((child) =>
    normalizeNavNode(child, configDir)
  )

  return {
    title: node.title,
    path: resolvedPath,
    icon: node.icon ?? null,
    type: node.type ?? (resolvedPath ? "page" : "group"),
    children: children.length ? children : undefined,
  }
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

  const spaces = (raw.navigation?.spaces ?? []).map((space) => {
    const rootDirInput = space.rootDir || "."
    const resolvedRootDir =
      resolveAssetPath(rootDirInput, configDir) ?? rootDirInput
    return {
      slug: space.slug,
      name: space.name,
      style: space.style ?? raw.site?.layout ?? "sidebar-dropdown",
      rootDir: resolvedRootDir,
      entry: resolveAssetPath(space.entry, configDir),
      tree: (space.tree ?? []).map((node) =>
        normalizeNavNode(node, resolvedRootDir)
      ),
    }
  })

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
      spaces,
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
