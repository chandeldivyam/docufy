// apps/web/src/theme/tokens.ts
export type TokenTarget = "light" | "dark" | "vars"
export type Control = "color" | "length" | "text"

export type TokenDef = {
  key: string
  target: TokenTarget
  group: "Surfaces" | "Brand" | "Sidebar" | "Scrollbar" | "Layout"
  control: Control
  label: string
  desc?: string
  default?: string
  advanced?: boolean
}

export const TOKEN_REGISTRY: TokenDef[] = [
  // Layout
  {
    key: "--radius",
    target: "vars",
    group: "Layout",
    control: "length",
    label: "Corner radius",
    default: "10px",
  },
  {
    key: "--dfy-content-pad",
    target: "vars",
    group: "Layout",
    control: "length",
    label: "Page padding",
    default: "28px",
  },

  // Optional scrollbar (advanced)
  {
    key: "--sb-size",
    target: "vars",
    group: "Scrollbar",
    control: "length",
    label: "Scrollbar size",
    default: "10px",
    advanced: true,
  },
  {
    key: "--sb-track",
    target: "vars",
    group: "Scrollbar",
    control: "color",
    label: "Scrollbar track",
    default: "oklch(0.92 0 0)",
    advanced: true,
  },
  {
    key: "--sb-thumb",
    target: "vars",
    group: "Scrollbar",
    control: "color",
    label: "Scrollbar thumb",
    default: "oklch(0.58 0 0)",
    advanced: true,
  },
  {
    key: "--sb-thumb-hover",
    target: "vars",
    group: "Scrollbar",
    control: "color",
    label: "Scrollbar thumb hover",
    default: "oklch(0.45 0 0)",
    advanced: true,
  },

  // Light: surfaces
  {
    key: "--bg",
    target: "light",
    group: "Surfaces",
    control: "color",
    label: "Background",
    default: "oklch(1 0 0)",
  },
  {
    key: "--fg",
    target: "light",
    group: "Surfaces",
    control: "color",
    label: "Foreground",
    default: "oklch(0.18 0 0)",
  },
  {
    key: "--muted",
    target: "light",
    group: "Surfaces",
    control: "color",
    label: "Muted",
    default: "oklch(0.58 0 0)",
  },
  {
    key: "--border",
    target: "light",
    group: "Surfaces",
    control: "color",
    label: "Border",
    default: "oklch(0.92 0 0)",
  },

  // Light: brand
  {
    key: "--primary",
    target: "light",
    group: "Brand",
    control: "color",
    label: "Primary",
    default: "oklch(0.38 0.07 240)",
  },
  {
    key: "--primary-fg",
    target: "light",
    group: "Brand",
    control: "color",
    label: "On primary",
    default: "oklch(0.98 0 0)",
  },

  // Light: sidebar
  {
    key: "--sidebar-bg",
    target: "light",
    group: "Sidebar",
    control: "color",
    label: "Sidebar bg",
    default: "oklch(0.985 0 0)",
  },
  {
    key: "--sidebar-fg",
    target: "light",
    group: "Sidebar",
    control: "color",
    label: "Sidebar text",
    default: "oklch(0.18 0 0)",
  },
  {
    key: "--sidebar-fg-muted",
    target: "light",
    group: "Sidebar",
    control: "color",
    label: "Sidebar muted",
    default: "oklch(0.45 0 0)",
  },
  {
    key: "--sidebar-border",
    target: "light",
    group: "Sidebar",
    control: "color",
    label: "Sidebar border",
    default: "oklch(0.92 0 0)",
  },
  {
    key: "--sidebar-hover",
    target: "light",
    group: "Sidebar",
    control: "color",
    label: "Sidebar hover",
    default: "color-mix(in oklab, var(--sidebar-fg) 4%, var(--sidebar-bg))",
  },

  // Dark: surfaces
  {
    key: "--bg",
    target: "dark",
    group: "Surfaces",
    control: "color",
    label: "Background",
    default: "oklch(0.17 0 0)",
  },
  {
    key: "--fg",
    target: "dark",
    group: "Surfaces",
    control: "color",
    label: "Foreground",
    default: "oklch(0.97 0 0)",
  },
  {
    key: "--muted",
    target: "dark",
    group: "Surfaces",
    control: "color",
    label: "Muted",
    default: "oklch(0.7 0 0)",
  },
  {
    key: "--border",
    target: "dark",
    group: "Surfaces",
    control: "color",
    label: "Border",
    default: "oklch(0.28 0 0)",
  },

  // Dark: brand
  {
    key: "--primary",
    target: "dark",
    group: "Brand",
    control: "color",
    label: "Primary",
    default: "oklch(0.75 0.12 260)",
  },
  {
    key: "--primary-fg",
    target: "dark",
    group: "Brand",
    control: "color",
    label: "On primary",
    default: "oklch(0.14 0 0)",
  },

  // Dark: sidebar
  {
    key: "--sidebar-bg",
    target: "dark",
    group: "Sidebar",
    control: "color",
    label: "Sidebar bg",
    default: "oklch(0.2 0 0)",
  },
  {
    key: "--sidebar-fg",
    target: "dark",
    group: "Sidebar",
    control: "color",
    label: "Sidebar text",
    default: "oklch(0.98 0 0)",
  },
  {
    key: "--sidebar-fg-muted",
    target: "dark",
    group: "Sidebar",
    control: "color",
    label: "Sidebar muted",
    default: "oklch(0.77 0 0)",
  },
  {
    key: "--sidebar-border",
    target: "dark",
    group: "Sidebar",
    control: "color",
    label: "Sidebar border",
    default: "oklch(0.3 0 0)",
  },
  {
    key: "--sidebar-hover",
    target: "dark",
    group: "Sidebar",
    control: "color",
    label: "Sidebar hover",
    default: "color-mix(in oklab, var(--sidebar-fg) 10%, var(--sidebar-bg))",
  },
]
