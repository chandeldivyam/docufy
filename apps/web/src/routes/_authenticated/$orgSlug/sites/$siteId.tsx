import { createFileRoute } from "@tanstack/react-router"
import { useLiveQuery } from "@tanstack/react-db"
import { authClient } from "@/lib/auth-client"
import {
  getOrgSpacesCollection,
  getSiteSpacesCollection,
  getSiteDomainsCollection,
  getSiteBuildsCollection,
  getOrgSitesCollection,
  emptySitesCollection,
  emptySpacesCollection,
  type SpaceRow,
  type SiteRow,
} from "@/lib/collections"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState, useMemo, useEffect, useRef } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowUp,
  ArrowDown,
  Plus,
  X,
  Globe,
  CheckCircle2,
  AlertCircle,
  Clock,
  Rocket,
  RefreshCw,
  ExternalLink,
  Copy,
  Loader2,
  ChevronDown,
  Upload,
  GripVertical,
} from "lucide-react"
import { toast } from "sonner"
import { uploadSiteAssetToBlob } from "@/lib/blob-uploader"
import { ThemeStudio } from "./ThemeStudio"

export const Route = createFileRoute("/_authenticated/$orgSlug/sites/$siteId")({
  ssr: false,
  loader: async () => null,
  component: SiteDetailPage,
})

function SiteDetailPage() {
  const { siteId } = Route.useParams()
  const { data: activeOrg } = authClient.useActiveOrganization()
  const activeOrgId = activeOrg?.id

  const sitesCol = useMemo(
    () => (activeOrgId ? getOrgSitesCollection(activeOrgId) : null),
    [activeOrgId]
  )
  const { data: sites } = useLiveQuery(
    (q) =>
      sitesCol
        ? q.from({ sites: sitesCol })
        : q.from({ sites: emptySitesCollection }),
    [sitesCol]
  )
  const site = sites?.find((s) => s.id === siteId)

  const spacesCol = useMemo(
    () => (activeOrgId ? getOrgSpacesCollection(activeOrgId) : null),
    [activeOrgId]
  )
  const { data: spaces } = useLiveQuery(
    (q) =>
      spacesCol
        ? q.from({ spaces: spacesCol })
        : q.from({ spaces: emptySpacesCollection }),
    [spacesCol]
  )

  const siteSpacesCol = useMemo(() => getSiteSpacesCollection(siteId), [siteId])
  const { data: selection } = useLiveQuery(
    (q) => q.from({ sel: siteSpacesCol }),
    [siteSpacesCol]
  )

  const domainsCol = useMemo(() => getSiteDomainsCollection(siteId), [siteId])
  const { data: domains } = useLiveQuery(
    (q) => q.from({ domains: domainsCol }),
    [domainsCol]
  )

  const siteBuildsCol = useMemo(() => getSiteBuildsCollection(siteId), [siteId])
  const { data: buildsRaw } = useLiveQuery(
    (q) => q.from({ builds: siteBuildsCol }),
    [siteBuildsCol]
  )
  const builds = (buildsRaw ?? [])
    .slice()
    .sort((a, b) => b.started_at.getTime() - a.started_at.getTime())
  useEffect(() => {
    const synthetic = (builds ?? []).filter((b) => Number(b.id) < 0)
    const hasReal = (builds ?? []).some(
      (b) =>
        Number(b.id) > 0 && (b.status === "queued" || b.status === "running")
    )
    if (hasReal && synthetic.length) {
      // Best-effort cleanup to hide the synthetic row once real row is visible
      synthetic.forEach((s) => {
        siteBuildsCol.delete(String(s.id))
      })
    }
  }, [builds, siteBuildsCol])

  const [newDomain, setNewDomain] = useState("")
  const [isAddingDomain, setIsAddingDomain] = useState(false)
  const [domainToDelete, setDomainToDelete] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const selectionLoaded = selection !== undefined

  if (!site || site == undefined) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading site details...</p>
        </div>
      </div>
    )
  }

  function BrandingCard() {
    const orgSlug = activeOrg?.slug
    type BrandingKind = "logo-light" | "logo-dark" | "favicon"
    const [busy, setBusy] = useState<Record<BrandingKind, boolean>>({
      "logo-light": false,
      "logo-dark": false,
      favicon: false,
    })

    function UploadField(props: {
      id: string
      label: string
      accept: string
      currentUrl?: string | null
      kind: BrandingKind
      previewClassName?: string
    }) {
      const { id, label, accept, currentUrl, kind, previewClassName } = props
      const inputRef = useRef<HTMLInputElement | null>(null)
      const loading = busy[kind]

      return (
        <div className="space-y-2">
          <Label htmlFor={id}>{label}</Label>
          <div
            className="rounded-lg border-2 border-dashed p-3 sm:p-4 hover:bg-accent/40 transition-colors cursor-pointer focus-visible:outline-none"
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                inputRef.current?.click()
              }
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              if (loading) return
              const f = e.dataTransfer.files?.[0]
              if (f) onPick(kind, f)
            }}
            aria-busy={loading}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={loading}
                  onClick={(e) => {
                    e.stopPropagation()
                    inputRef.current?.click()
                  }}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {currentUrl ? "Replace file" : "Upload file"}
                </Button>
                <span className="text-xs text-muted-foreground hidden sm:block">
                  or drag & drop
                </span>
              </div>
              <span className="text-xs text-muted-foreground hidden md:block">
                {accept}
              </span>
            </div>
            {currentUrl ? (
              <div className="mt-3">
                <img
                  src={currentUrl}
                  alt={label}
                  className={
                    previewClassName
                      ? `object-contain max-w-full ${previewClassName}`
                      : "h-10 max-w-full object-contain"
                  }
                />
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                No file uploaded yet
              </p>
            )}
            <input
              ref={inputRef}
              id={id}
              className="sr-only"
              type="file"
              accept={accept}
              onChange={(e) =>
                e.target.files?.[0] && onPick(kind, e.target.files[0])
              }
              disabled={loading}
            />
          </div>
        </div>
      )
    }

    async function onPick(kind: BrandingKind, f: File) {
      if (!site) return
      try {
        setBusy((m) => ({ ...m, [kind]: true }))
        const { url } = await uploadSiteAssetToBlob(f, {
          orgSlug,
          siteId: site.id,
          kind,
        })
        if (kind === "logo-light") {
          await sitesCol?.update(site.id, (d) => void (d.logo_url_light = url))
        } else if (kind === "logo-dark") {
          await sitesCol?.update(site.id, (d) => void (d.logo_url_dark = url))
        } else {
          await sitesCol?.update(site.id, (d) => void (d.favicon_url = url))
        }
        toast.success("Uploaded")
      } catch (e) {
        console.error(e)
        toast.error("Upload failed")
      } finally {
        setBusy((m) => ({ ...m, [kind]: false }))
      }
    }

    return (
      <Card className="border-none shadow-none">
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>
            Logos for light/dark themes and favicon
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <UploadField
              id="logo-light"
              label="Logo (Light)"
              accept=".svg,.png,.jpg,.jpeg,.webp"
              currentUrl={site?.logo_url_light}
              kind="logo-light"
              previewClassName="bg-white p-1 rounded w-[120px]"
            />
            <UploadField
              id="logo-dark"
              label="Logo (Dark)"
              accept=".svg,.png,.jpg,.jpeg,.webp"
              currentUrl={site?.logo_url_dark}
              kind="logo-dark"
              previewClassName="bg-black p-1 rounded w-[120px]"
            />
            <UploadField
              id="favicon"
              label="Favicon"
              accept=".png,.ico,.svg"
              currentUrl={site?.favicon_url}
              kind="favicon"
              previewClassName="h-8 w-8"
            />
          </div>
        </CardContent>
      </Card>
    )
  }

  const orderedSelection = (selection ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
  const selectedIds = new Set(orderedSelection.map((s) => s.space_id))
  const allSpacesById = new Map((spaces ?? []).map((s) => [s.id, s]))
  const selected = orderedSelection
    .map((sel) => allSpacesById.get(sel.space_id))
    .filter((space): space is SpaceRow => Boolean(space))
  const available = (spaces ?? [])
    .filter((s) => !selectedIds.has(s.id))
    .sort((a, b) => a.name.localeCompare(b.name))

  async function applySelection(nextOrderedIds: string[]) {
    if (!selectionLoaded) return
    setIsSaving(true)
    try {
      const currentRows = (selection ?? [])
        .slice()
        .sort((a, b) => a.position - b.position)
      const currentMap = new Map(currentRows.map((row) => [row.space_id, row]))
      const nextSet = new Set(nextOrderedIds)

      for (const row of currentRows) {
        if (!nextSet.has(row.space_id)) {
          await siteSpacesCol.delete(`${row.site_id}:${row.space_id}`)
        }
      }

      for (let i = 0; i < nextOrderedIds.length; i++) {
        const spaceId = nextOrderedIds[i]
        if (!spaceId) continue
        const existing = currentMap.get(spaceId)
        if (!existing) {
          await siteSpacesCol.insert({
            site_id: siteId,
            space_id: spaceId,
            position: i,
            style: "dropdown",
          })
        } else if (existing.position !== i) {
          await siteSpacesCol.update(`${siteId}:${spaceId}`, (draft) => {
            draft.position = i
          })
        }
      }
    } catch (error) {
      console.error("Failed to update space selection", error)
    } finally {
      setIsSaving(false)
    }
  }

  async function addDomain() {
    const d = newDomain.trim().toLowerCase()
    if (!d) return
    setIsAddingDomain(true)
    try {
      await domainsCol.insert({
        id: crypto.randomUUID(),
        site_id: siteId,
        domain: d,
        verified: false,
        last_checked_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      toast.success("Domain added successfully")
      setNewDomain("")
    } catch (error) {
      console.error("Failed to add domain", error)
      toast.error("Failed to add domain")
    } finally {
      setIsAddingDomain(false)
    }
  }

  async function removeDomain(domainId: string) {
    try {
      await domainsCol.delete(domainId)
      toast.success("Domain removed")
      setDomainToDelete(null)
    } catch (error) {
      console.error("Failed to remove domain", error)
      toast.error("Failed to remove domain")
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  const latestBuild = builds?.sort(
    (a, b) => b.started_at.getTime() - a.started_at.getTime()
  )[0]

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{site.name}</h1>
          <p className="text-muted-foreground mt-1">
            Manage your site settings, content, and deployments
          </p>
        </div>
        <div className="flex items-center gap-2">
          {site.primary_host && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open(`https://${site.primary_host}`, "_blank")
              }
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Site
            </Button>
          )}
          {latestBuild && (
            <Badge
              variant={
                latestBuild.status === "success"
                  ? "default"
                  : latestBuild.status === "failed"
                    ? "destructive"
                    : "secondary"
              }
            >
              {latestBuild.status === "running" && (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              )}
              {latestBuild.status}
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 max-w-lg">
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="theme">Theme</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="domains">Domains</TabsTrigger>
          <TabsTrigger value="deploys">Deploys</TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Site Configuration</CardTitle>
              <CardDescription>
                Basic settings for your documentation site
              </CardDescription>
            </CardHeader>
            <BrandingCard />
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="site-name">Site Name</Label>
                  <Input
                    id="site-name"
                    value={site.name}
                    onChange={(e) =>
                      sitesCol?.update(
                        site.id,
                        (d) => void (d.name = e.target.value)
                      )
                    }
                    placeholder="My Documentation"
                  />
                  <p className="text-xs text-muted-foreground">
                    Display name for your site
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="site-slug">URL Slug</Label>
                  <Input
                    id="site-slug"
                    value={site.slug}
                    onChange={(e) =>
                      sitesCol?.update(
                        site.id,
                        (d) => void (d.slug = e.target.value)
                      )
                    }
                    disabled
                    placeholder="my-docs"
                  />
                  <p className="text-xs text-muted-foreground">
                    URL-friendly identifier
                  </p>
                </div>
              </div>

              {site.primary_host && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Primary URL:</span>
                      <code className="text-sm bg-background px-2 py-0.5 rounded">
                        https://{site.primary_host}
                      </code>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        copyToClipboard(`https://${site.primary_host}`)
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="theme" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Theme</CardTitle>
              <CardDescription>
                Customize colors, surfaces, and layout tokens
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ThemeStudio siteId={siteId} orgId={activeOrgId!} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Content Spaces</CardTitle>
              <CardDescription>
                Select and organize the spaces to include in your site
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Selected Spaces */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">
                      Selected Spaces ({selected.length})
                    </h4>
                    {selected.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {selected.length} space
                        {selected.length !== 1 ? "s" : ""} selected
                      </Badge>
                    )}
                  </div>

                  {selected.length === 0 ? (
                    <div className="border-2 border-dashed rounded-lg p-8 text-center">
                      <p className="text-muted-foreground text-sm">
                        No spaces selected yet
                      </p>
                      <p className="text-muted-foreground text-xs mt-1">
                        Add spaces from the available list
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selected.map((space, idx) => (
                        <div
                          key={space.id}
                          className="flex items-center gap-2 p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{space.name}</p>
                            {space.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {space.description}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              disabled={
                                !selectionLoaded || idx === 0 || isSaving
                              }
                              onClick={() => {
                                const arr = selected.map((s) => s.id)
                                const current = arr[idx]
                                const swapWith = arr[idx - 1]
                                if (!current || !swapWith) return
                                arr[idx] = swapWith
                                arr[idx - 1] = current
                                applySelection(arr)
                              }}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>

                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              disabled={
                                !selectionLoaded ||
                                idx === selected.length - 1 ||
                                isSaving
                              }
                              onClick={() => {
                                const arr = selected.map((s) => s.id)
                                const current = arr[idx]
                                const next = arr[idx + 1]
                                if (!current || !next) return
                                arr[idx] = next
                                arr[idx + 1] = current
                                applySelection(arr)
                              }}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>

                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              disabled={!selectionLoaded || isSaving}
                              onClick={() => {
                                const arr = selected
                                  .map((s) => s.id)
                                  .filter((id) => id !== space.id)
                                applySelection(arr)
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Available Spaces */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">
                      Available Spaces ({available.length})
                    </h4>
                  </div>

                  {available.length === 0 ? (
                    <div className="border-2 border-dashed rounded-lg p-8 text-center">
                      <p className="text-muted-foreground text-sm">
                        All spaces have been selected
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {available.map((space) => (
                        <div
                          key={space.id}
                          className="flex items-center gap-2 p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{space.name}</p>
                            {space.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {space.description}
                              </p>
                            )}
                          </div>

                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={!selectionLoaded || isSaving}
                            onClick={() => {
                              const arr = [
                                ...selected.map((s) => s.id),
                                space.id,
                              ]
                              applySelection(arr)
                            }}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {/* TODO - we need to a beautiful UX for the user to add his buttons for renderer here. They should also have the ability to edit and delete the buttons and change the rank */}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Navigation Buttons</CardTitle>
              <CardDescription>
                Configure quick-access buttons and where they appear in the UI.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ButtonsEditor site={site} sitesCol={sitesCol} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Domains Tab */}
        <TabsContent value="domains" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Custom Domains</CardTitle>
              <CardDescription>
                Configure custom domains for your documentation site
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add domain form */}
              <div className="flex gap-2">
                <Input
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addDomain()}
                  placeholder="docs.example.com"
                  className="flex-1"
                />
                <Button
                  onClick={addDomain}
                  disabled={!newDomain || isAddingDomain}
                >
                  {isAddingDomain ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Add Domain
                </Button>
              </div>

              {/* Domains list */}
              {domains && domains.length > 0 ? (
                <div className="space-y-2">
                  {domains.map((domain) => (
                    <div
                      key={domain.id}
                      className="border rounded-lg overflow-hidden"
                    >
                      {/* Main domain info */}
                      <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{domain.domain}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {domain.error ? (
                                <Badge
                                  variant="destructive"
                                  className="text-xs"
                                >
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Error
                                </Badge>
                              ) : domain.verified ? (
                                <Badge variant="outline" className="text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
                                  Verified
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  <AlertCircle className="h-3 w-3 mr-1 text-amber-600" />
                                  Pending verification
                                </Badge>
                              )}
                              {domain.last_checked_at && (
                                <span className="text-xs text-muted-foreground">
                                  Last checked{" "}
                                  {domain.last_checked_at.toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {!domain.verified && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                toast.info("Verifying domain...")
                                domainsCol.update(domain.id, (d) => {
                                  d.last_checked_at = new Date()
                                })
                              }}
                            >
                              <RefreshCw className="h-4 w-4 mr-1" />
                              Check now
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDomainToDelete(domain.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            Remove
                          </Button>
                        </div>
                      </div>

                      {/* DNS Instructions for unverified domains */}
                      {(!domain.verified || domain.error) && (
                        <div className="border-t bg-muted/30 p-4">
                          <div className="space-y-3">
                            {domain.error && (
                              <div className="flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-destructive">
                                    Verification failed
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1 break-all">
                                    {domain.error}
                                  </p>
                                </div>
                              </div>
                            )}
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                  DNS Configuration Required
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Add this CNAME record to your DNS provider to
                                  verify domain ownership
                                </p>
                              </div>
                            </div>

                            <div className="bg-background rounded-lg border p-3 space-y-3">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1">
                                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Record Type
                                  </Label>
                                  <div className="flex items-center gap-2">
                                    <code className="text-sm bg-muted px-2 py-1 rounded font-mono">
                                      CNAME
                                    </code>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0"
                                      onClick={() => copyToClipboard("CNAME")}
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Name/Host
                                  </Label>
                                  <div className="flex items-center gap-2">
                                    <code className="text-sm bg-muted px-2 py-1 rounded font-mono flex-1 min-w-0 truncate">
                                      {(() => {
                                        const parts = domain.domain.split(".")
                                        // If it's an apex domain (e.g., example.com), use @ or blank
                                        if (parts.length <= 2) return "@"
                                        // Otherwise, return just the subdomain part (e.g., 'test' from 'test.learno.fun')
                                        return parts[0]
                                      })()}
                                    </code>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0 flex-shrink-0"
                                      onClick={() => {
                                        const parts = domain.domain.split(".")
                                        const nameValue =
                                          parts.length <= 2 ? "@" : parts[0]
                                        copyToClipboard(nameValue!)
                                      }}
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {(() => {
                                      const parts = domain.domain.split(".")
                                      if (parts.length <= 2) {
                                        return "Use @ for apex domain or leave blank if @ is not supported"
                                      }
                                      return `Just the subdomain part of ${domain.domain}`
                                    })()}
                                  </p>
                                </div>

                                <div className="space-y-1 sm:col-span-2">
                                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Value/Target
                                  </Label>
                                  <div className="flex items-center gap-2">
                                    <code className="text-sm bg-muted px-2 py-1 rounded font-mono flex-1 min-w-0">
                                      cname.vercel-dns.com.
                                    </code>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0 flex-shrink-0"
                                      onClick={() =>
                                        copyToClipboard("cname.vercel-dns.com.")
                                      }
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>

                              <div className="pt-2 border-t">
                                <details className="group">
                                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
                                    <span>
                                      Need help with DNS configuration?
                                    </span>
                                    <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                                  </summary>
                                  <div className="mt-2 text-xs text-muted-foreground space-y-1">
                                    <p>
                                      1. Log in to your domain registrar or DNS
                                      provider
                                    </p>
                                    <p>
                                      2. Navigate to DNS management or DNS
                                      records
                                    </p>
                                    <p>
                                      3. Add a new CNAME record with the values
                                      above
                                    </p>
                                    <p>
                                      4. Save the changes and wait for
                                      propagation (up to 24 hours)
                                    </p>
                                    <p>
                                      5. Click "Check now" to verify the
                                      configuration
                                    </p>
                                  </div>
                                </details>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No custom domains configured</p>
                  <p className="text-xs mt-1">Add a domain to get started</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deploys Tab */}
        <TabsContent value="deploys" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Deployment History</CardTitle>
              <CardDescription>
                View and manage your site deployments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Placeholder for publish functionality */}
              <div className="mb-6 p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <Rocket className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">Publish to Production</p>
                    <p className="text-sm text-muted-foreground">
                      Deployment functionality coming soon
                    </p>
                  </div>
                  <Button
                    onClick={async () => {
                      // Block if another build is running/queued
                      const busy = (builds ?? []).some(
                        (b) => b.status === "running" || b.status === "queued"
                      )
                      if (busy || selected.length === 0) return

                      // Insert a client-only synthetic row with negative id
                      await siteBuildsCol.insert({
                        id: -Date.now(),
                        site_id: siteId,
                        build_id: `local:${crypto.randomUUID()}`,
                        status: "running",
                        operation: "publish",
                        actor_user_id: "me", // or from session
                        selected_space_ids_snapshot: selected.map((s) => s.id),
                        target_build_id: null,
                        items_total: selected.length || 1,
                        items_done: 0,
                        pages_written: 0,
                        bytes_written: 0,
                        started_at: new Date(),
                        finished_at: null,
                      })
                      // onInsert on the collection will enqueue the real publish
                    }}
                    disabled={
                      selected.length === 0 ||
                      (builds ?? []).some(
                        (b) => b.status === "running" || b.status === "queued"
                      )
                    }
                  >
                    <Rocket className="h-4 w-4 mr-2" />
                    Publish
                  </Button>
                </div>
              </div>

              {/* Build history */}
              {builds && builds.length > 0 ? (
                <div className="space-y-2">
                  {builds
                    .sort(
                      (a, b) => b.started_at.getTime() - a.started_at.getTime()
                    )
                    .slice(0, 10)
                    .map((build) => (
                      <div
                        key={build.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {build.operation === "publish" ? (
                            <Rocket className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <RefreshCw className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                {build.operation === "publish"
                                  ? "Deploy"
                                  : "Revert"}{" "}
                                #{build.build_id}
                              </p>
                              <Badge
                                variant={
                                  build.status === "success"
                                    ? "default"
                                    : build.status === "failed"
                                      ? "destructive"
                                      : build.status === "running"
                                        ? "secondary"
                                        : "outline"
                                }
                                className="text-xs"
                              >
                                {build.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(build.started_at).toLocaleString()}
                              </span>
                              {build.finished_at && (
                                <span>
                                  Duration:{" "}
                                  {Math.round(
                                    (new Date(build.finished_at).getTime() -
                                      new Date(build.started_at).getTime()) /
                                      1000
                                  )}
                                  s
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {build.operation === "publish" &&
                          build.status === "success" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                const busy = (builds ?? []).some(
                                  (b) =>
                                    b.status === "running" ||
                                    b.status === "queued"
                                )
                                if (busy) return
                                await siteBuildsCol.insert({
                                  id: -Date.now(),
                                  site_id: siteId,
                                  build_id: `local:${crypto.randomUUID()}`,
                                  status: "running",
                                  operation: "revert",
                                  actor_user_id: "me",
                                  selected_space_ids_snapshot: [],
                                  target_build_id: build.build_id,
                                  items_total: 1,
                                  items_done: 0,
                                  pages_written: 0,
                                  bytes_written: 0,
                                  started_at: new Date(),
                                  finished_at: null,
                                })
                              }}
                            >
                              Revert
                            </Button>
                          )}
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No deployments yet</p>
                  <p className="text-xs mt-1">
                    Your deployment history will appear here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Domain Confirmation Dialog */}
      <AlertDialog
        open={!!domainToDelete}
        onOpenChange={() => setDomainToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Domain</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this domain? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => domainToDelete && removeDomain(domainToDelete)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ButtonsEditor({
  site,
  sitesCol,
}: {
  site: SiteRow
  sitesCol: ReturnType<typeof getOrgSitesCollection> | null
}) {
  const positions = [
    { value: "sidebar_top", label: "Sidebar (Top)" },
    { value: "sidebar_bottom", label: "Sidebar (Bottom)" },
    { value: "topbar_left", label: "Topbar (Left)" },
    { value: "topbar_right", label: "Topbar (Right)" },
  ] as const

  type Btn = {
    id: string
    label: string
    href: string
    iconName?: string | null
    slug?: string | null
    position: (typeof positions)[number]["value"]
    rank: number
    target?: "_self" | "_blank"
  }

  const buttons: Btn[] = Array.isArray(site.buttons) ? site.buttons : []

  function byPos(p: Btn["position"]) {
    return buttons
      .filter((b) => b.position === p)
      .slice()
      .sort((a, b) => a.rank - b.rank)
  }

  async function apply(next: Btn[]) {
    await sitesCol?.update(site.id, (draft) => void (draft.buttons = next))
  }

  async function addButton() {
    const id = crypto.randomUUID()
    const next: Btn = {
      id,
      label: "New Button",
      href: "/",
      iconName: null,
      slug: null,
      position: "sidebar_top",
      rank: (byPos("sidebar_top").at(-1)?.rank ?? -1) + 1,
      target: "_self",
    }
    await apply([...buttons, next])
  }

  function move(b: Btn, dir: -1 | 1) {
    const siblings = byPos(b.position)
    const idx = siblings.findIndex((x) => x.id === b.id)
    const swapWith = siblings[idx + dir]
    if (!swapWith) return
    const aRank = b.rank
    const bRank = swapWith.rank
    const next = buttons.map((x) =>
      x.id === b.id
        ? { ...x, rank: bRank }
        : x.id === swapWith.id
          ? { ...x, rank: aRank }
          : x
    )
    apply(next)
  }

  function update(b: Btn, patch: Partial<Btn>) {
    const candidate = { ...b, ...patch }
    // simple validation:
    if (!candidate.label.trim()) {
      console.warn("skip update: label empty")
      return
    }
    if (!candidate.href.trim()) {
      console.warn("skip update: href empty")
      return
    }
    // optionally: validate that href is valid URL or path
    const next = buttons.map((x) => (x.id === b.id ? candidate : x))
    // same logic for position/rank
    if (patch.position && patch.position !== b.position) {
      const end = (byPos(patch.position).at(-1)?.rank ?? -1) + 1
      next.forEach((n) => {
        if (n.id === b.id) n.rank = end
      })
    }
    apply(next)
  }

  function remove(b: Btn) {
    apply(buttons.filter((x) => x.id !== b.id))
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Buttons can link to internal routes (e.g.{" "}
          <code className="px-1">/space/slug/page</code>) or external URLs. Use
          the position and rank to control placement & order.
        </p>
        <Button size="sm" onClick={addButton}>
          <Plus className="h-4 w-4 mr-1" />
          Add Button
        </Button>
      </div>

      {positions.map((pos) => {
        const items = byPos(pos.value)
        return (
          <div key={pos.value} className="space-y-2">
            <h4 className="text-sm font-medium">{pos.label}</h4>
            {items.length === 0 ? (
              <div className="border-2 border-dashed rounded-lg p-4 text-xs text-muted-foreground">
                No buttons in this section
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((b, idx) => (
                  <div
                    key={b.id}
                    className="flex flex-col sm:flex-row gap-2 sm:items-center p-3 border rounded-lg bg-card"
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <Input
                        value={b.label}
                        onChange={(e) => update(b, { label: e.target.value })}
                        className="w-[160px]"
                        placeholder="Label"
                      />
                      <Input
                        value={b.href}
                        onChange={(e) => update(b, { href: e.target.value })}
                        className="w-[260px]"
                        placeholder="/docs/getting-started or https://…"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                      <select
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                        value={b.position}
                        onChange={(e) =>
                          update(b, {
                            position: e.target.value as Btn["position"],
                          })
                        }
                      >
                        {positions.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                      <select
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                        value={b.target ?? "_blank"}
                        onChange={(e) =>
                          update(b, {
                            target: e.target.value as "_self" | "_blank",
                          })
                        }
                      >
                        <option value="_blank">New tab</option>
                        <option value="_self">Same tab</option>
                      </select>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          disabled={idx === 0}
                          onClick={() => move(b, -1)}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          disabled={idx === items.length - 1}
                          onClick={() => move(b, +1)}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => remove(b)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
