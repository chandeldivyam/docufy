import { useEffect, useMemo, useState } from "react"
import { useLiveQuery } from "@tanstack/react-db"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { getSiteThemeCollection } from "@/lib/collections"
import { TOKEN_REGISTRY, type TokenDef } from "@/components/tokens"
import { computePickerValue, hexToOklchOrNull } from "@/components/color"

type ThemeMap = Record<string, string>
type ThemeDraft = { light: ThemeMap; dark: ThemeMap; vars: ThemeMap }

function emptyDraft(): ThemeDraft {
  const light: ThemeMap = {}
  const dark: ThemeMap = {}
  const vars: ThemeMap = {}
  for (const t of TOKEN_REGISTRY) {
    const val = t.default ?? ""
    if (t.target === "light") light[t.key] = val
    else if (t.target === "dark") dark[t.key] = val
    else vars[t.key] = val
  }
  return { light, dark, vars }
}

function GroupEditor({
  target,
  group,
  draft,
  setDraft,
}: {
  target: "light" | "dark" | "vars"
  group: TokenDef["group"]
  draft: ThemeDraft
  setDraft: (next: ThemeDraft) => void
}) {
  const tokens = TOKEN_REGISTRY.filter(
    (t) => t.target === target && t.group === group && !t.advanced
  )
  if (!tokens.length) return null

  const bucket =
    target === "light"
      ? draft.light
      : target === "dark"
        ? draft.dark
        : draft.vars

  return (
    <Card>
      <CardHeader>
        <CardTitle>{group}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {tokens.map((t) => (
          <div key={`${target}:${t.key}`} className="space-y-2">
            <Label htmlFor={`${target}:${t.key}`}>{t.label}</Label>
            <div className="flex">
              {t.control !== "color" && (
                <Input
                  id={`${target}:${t.key}`}
                  value={bucket[t.key] ?? ""} // ensure string
                  onChange={(e) => {
                    const v: string = e.target.value ?? "" // <-- fixes TS2322
                    const next: ThemeDraft = {
                      light: { ...draft.light },
                      dark: { ...draft.dark },
                      vars: { ...draft.vars },
                    }
                    ;(target === "light"
                      ? next.light
                      : target === "dark"
                        ? next.dark
                        : next.vars)[t.key] = v
                    setDraft(next)
                  }}
                  placeholder={t.default}
                />
              )}
              {/* Optional: add a color input for color tokens only (it writes raw text; no preview logic) */}
              {t.control === "color" && (
                <div className="flex gap-2">
                  <Input
                    id={`${target}:${t.key}`}
                    value={bucket[t.key] ?? ""}
                    onChange={(e) => {
                      const v: string = e.target.value ?? ""
                      const next = {
                        light: { ...draft.light },
                        dark: { ...draft.dark },
                        vars: { ...draft.vars },
                      }
                      ;(target === "light"
                        ? next.light
                        : target === "dark"
                          ? next.dark
                          : next.vars)[t.key] = v
                      setDraft(next)
                    }}
                    placeholder={t.default}
                  />
                  {(() => {
                    const { hex, enabled } = computePickerValue(
                      bucket[t.key] ?? t.default ?? ""
                    )
                    return (
                      <input
                        type="color"
                        className="h-10 w-12 rounded border"
                        value={hex}
                        disabled={!enabled}
                        onChange={(e) => {
                          const pickedHex = e.target.value ?? ""
                          const asOklch =
                            hexToOklchOrNull(pickedHex) ?? pickedHex // prefer OKLCH, fallback hex
                          const next = {
                            light: { ...draft.light },
                            dark: { ...draft.dark },
                            vars: { ...draft.vars },
                          }
                          ;(target === "light"
                            ? next.light
                            : target === "dark"
                              ? next.dark
                              : next.vars)[t.key] = asOklch
                          setDraft(next)
                        }}
                        aria-label={`${t.label} color`}
                        title={
                          enabled
                            ? "Pick a color"
                            : "Picker disabled for expressions like color-mix() or var()"
                        }
                      />
                    )
                  })()}
                </div>
              )}
            </div>
            {t.desc ? (
              <p className="text-xs text-muted-foreground">{t.desc}</p>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function ThemeStudio({
  siteId,
  orgId,
}: {
  siteId: string
  orgId: string
}) {
  const themeCol = useMemo(() => getSiteThemeCollection(siteId), [siteId])
  const { data } = useLiveQuery((q) => q.from({ theme: themeCol }), [themeCol])
  const row = data?.[0]

  const base = useMemo(() => emptyDraft(), [])
  const [draft, setDraft] = useState<ThemeDraft>({
    light: base.light,
    dark: base.dark,
    vars: base.vars,
  })

  // Hydrate UI state from DB when the row loads or changes
  useEffect(() => {
    if (!row) return
    setDraft({
      light: { ...base.light, ...(row.light_tokens ?? {}) },
      dark: { ...base.dark, ...(row.dark_tokens ?? {}) },
      vars: { ...base.vars, ...(row.vars ?? {}) },
    })
  }, [row, base.light, base.dark, base.vars])

  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      if (row) {
        await themeCol.update(row.site_id, (d) => {
          d.light_tokens = draft.light
          d.dark_tokens = draft.dark
          d.vars = draft.vars
        })
      } else {
        // 👇 make sure we send orgId so onInsert -> trpc has it (even though server derives it)
        await themeCol.insert({
          site_id: siteId,
          organization_id: orgId,
          version: 1,
          light_tokens: draft.light,
          dark_tokens: draft.dark,
          vars: draft.vars,
          updated_at: new Date(),
        })
      }
      toast.success("Theme saved (publish to apply).")
    } catch (e) {
      console.error(e)
      toast.error("Failed to save theme")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <Tabs defaultValue="light">
        <TabsList>
          <TabsTrigger value="light">Light</TabsTrigger>
          <TabsTrigger value="dark">Dark</TabsTrigger>
          <TabsTrigger value="vars">Layout</TabsTrigger>
        </TabsList>

        <TabsContent value="light" className="space-y-4">
          <GroupEditor
            target="light"
            group="Brand"
            draft={draft}
            setDraft={setDraft}
          />
          <GroupEditor
            target="light"
            group="Surfaces"
            draft={draft}
            setDraft={setDraft}
          />
          <GroupEditor
            target="light"
            group="Sidebar"
            draft={draft}
            setDraft={setDraft}
          />
        </TabsContent>

        <TabsContent value="dark" className="space-y-4">
          <GroupEditor
            target="dark"
            group="Brand"
            draft={draft}
            setDraft={setDraft}
          />
          <GroupEditor
            target="dark"
            group="Surfaces"
            draft={draft}
            setDraft={setDraft}
          />
          <GroupEditor
            target="dark"
            group="Sidebar"
            draft={draft}
            setDraft={setDraft}
          />
        </TabsContent>

        <TabsContent value="vars" className="space-y-4">
          <GroupEditor
            target="vars"
            group="Layout"
            draft={draft}
            setDraft={setDraft}
          />
          <GroupEditor
            target="vars"
            group="Scrollbar"
            draft={draft}
            setDraft={setDraft}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
