import * as React from "react"
import { useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "@tanstack/react-db"
import { authClient } from "@/lib/auth-client"
import {
  myOrganizationsCollection,
  getOrgSpacesCollection,
  emptySpacesCollection,
  getOrgSitesCollection,
  emptySitesCollection,
  type SpaceRow,
} from "@/lib/collections"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { useTheme } from "@/components/theme-provider"
import { Home, Moon, Settings, Sun } from "lucide-react"

type Cmd = {
  label: string
  to: string
  params?: Record<string, string>
  keywords?: string[]
  icon?: React.ReactNode
}

export function CommandPalette({ orgSlug }: { orgSlug?: string }) {
  const navigate = useNavigate()
  const [open, setOpen] = React.useState(false)
  const { setTheme } = useTheme()

  // Respect inputs so cmd/ctrl+k does not collide with typing
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      const t = e.target as HTMLElement | null
      const isTyping =
        !!t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)

      if (isMod && e.key.toLowerCase() === "k" && !isTyping) {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  React.useEffect(() => {
    const onToggle = () => setOpen((v) => !v)
    window.addEventListener("docufy:toggle-cmdk", onToggle)
    return () => window.removeEventListener("docufy:toggle-cmdk", onToggle)
  }, [])

  // Resolve orgId so we can query spaces/sites
  const { data: myOrgs } = useLiveQuery((q) =>
    q.from({ myOrganizations: myOrganizationsCollection })
  )
  const activeOrg = authClient.useActiveOrganization().data
  const orgId =
    (orgSlug
      ? myOrgs?.find((o) => o.org_slug === orgSlug)?.organization_id
      : null) ?? activeOrg?.id

  const spacesCol = React.useMemo(
    () => (orgId ? getOrgSpacesCollection(orgId) : emptySpacesCollection),
    [orgId]
  )
  const sitesCol = React.useMemo(
    () => (orgId ? getOrgSitesCollection(orgId) : emptySitesCollection),
    [orgId]
  )

  const { data: spaces } = useLiveQuery(
    (q) => q.from({ spaces: spacesCol }),
    [spacesCol]
  )
  const { data: sites } = useLiveQuery(
    (q) => q.from({ sites: sitesCol }),
    [sitesCol]
  )

  const go = (cmd: Cmd) => {
    setOpen(false)
    navigate({ to: cmd.to, params: cmd.params ?? {} })
  }

  const navCommands: Cmd[] = orgSlug
    ? [
        { label: "Home", to: "/$orgSlug", params: { orgSlug }, icon: <Home /> },
        {
          label: "Settings",
          to: "/$orgSlug/settings",
          params: { orgSlug },
          icon: <Settings />,
        },
      ]
    : [
        { label: "Workspaces", to: "/_authenticated/orgs" },
        { label: "Go to active org", to: "/_authenticated/_active-org" },
      ]

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results</CommandEmpty>

        <CommandGroup heading="Navigation">
          {navCommands.map((c) => (
            <CommandItem
              key={c.label}
              value={`nav ${c.label}`}
              onSelect={() => go(c)}
            >
              {c.icon}
              {c.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {orgSlug && (spaces?.length ?? 0) > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Spaces">
              {spaces!.map((s: SpaceRow) => (
                <CommandItem
                  key={s.id}
                  value={`space ${s.name} ${s.slug ?? ""}`}
                  onSelect={() =>
                    go({
                      label: s.name,
                      to: "/$orgSlug/spaces/$spaceId",
                      params: { orgSlug: orgSlug!, spaceId: s.id },
                    })
                  }
                >
                  {s.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {orgSlug && (sites?.length ?? 0) > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Sites">
              {sites!.map((site) => (
                <CommandItem
                  key={site.id}
                  value={`site ${site.name} ${site.slug ?? ""}`}
                  onSelect={() =>
                    go({
                      label: site.name,
                      to: "/$orgSlug/sites/$siteId",
                      params: { orgSlug: orgSlug!, siteId: site.id },
                    })
                  }
                >
                  {site.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Theme">
          <CommandItem
            onSelect={() => {
              setTheme("light")
              setOpen(false)
            }}
          >
            <Sun className="mr-2 h-4 w-4" />
            Light
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setTheme("dark")
              setOpen(false)
            }}
          >
            <Moon className="mr-2 h-4 w-4" />
            Dark
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
