// ./apps/web/src/components/api/ApiSpecEditor.tsx
import { useMemo, useState, useEffect } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { uploadFileToBlob } from "@/lib/blob-uploader"
import { getSpaceDocumentsCollection } from "@/lib/collections"
import { toast } from "sonner"

// Spec utils
import * as YAML from "yaml" // YAML.parse(...)  (browser-friendly)
// Docs: https://eemeli.org/yaml/
import { dereference } from "@scalar/openapi-parser"
// Deref docs: https://github.com/scalar/openapi-parser

type Props = {
  orgSlug: string
  spaceId: string
  parentDocId: string // the api_spec document whose children we'll create
  apiSpecBlobKey: string | null | undefined
}

const METHODS = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
  "trace",
] as const
// OpenAPI paths/operations reference: https://swagger.io/docs/specification/v3_0/paths-and-operations/

export function ApiSpecEditor({
  orgSlug,
  spaceId,
  parentDocId,
  apiSpecBlobKey,
}: Props) {
  const [specText, setSpecText] = useState("")
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loadingExistingSpec, setLoadingExistingSpec] = useState(false)

  const docsCol = useMemo(() => getSpaceDocumentsCollection(spaceId), [spaceId])

  // Initialize blobUrl from existing apiSpecBlobKey
  useEffect(() => {
    if (apiSpecBlobKey && !blobUrl) {
      setBlobUrl(apiSpecBlobKey)
    }
  }, [apiSpecBlobKey, blobUrl])

  // Helper: sniff format and parse string into JS object
  function parseLooseOpenAPI(input: string) {
    const trimmed = input.trim()
    if (!trimmed) return null
    try {
      // quick JSON check
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        return JSON.parse(trimmed)
      }
    } catch {
      /* fall back to YAML */
    }
    try {
      return YAML.parse(input)
    } catch (err) {
      console.error(err)
      toast.error("Failed to parse spec as JSON or YAML")
      return null
    }
  }

  // Load existing spec content for editing
  async function loadExistingSpec() {
    if (!apiSpecBlobKey) return

    setLoadingExistingSpec(true)
    try {
      const response = await fetch(apiSpecBlobKey)
      if (!response.ok) {
        throw new Error(`Failed to fetch spec: ${response.statusText}`)
      }
      const content = await response.text()
      setSpecText(content)
      toast.success("Spec loaded for editing")
    } catch (err) {
      console.error(err)
      toast.error("Failed to load existing spec")
    } finally {
      setLoadingExistingSpec(false)
    }
  }

  async function handleUpload() {
    if (!specText.trim()) {
      toast.error("Paste a spec first")
      return
    }
    try {
      setUploading(true)
      // Create a File from the text so we can use the same Blob flow
      const filename = "openapi-spec.yaml" // works for JSON or YAML
      const file = new File([specText], filename, { type: "text/yaml" })
      const res = await uploadFileToBlob(
        file,
        { orgSlug, documentId: parentDocId },
        "openapi"
      )
      setBlobUrl(res.url)
      // Save blob key/url on parent api_spec doc (optimistically + tRPC via collection update)
      await docsCol.update(parentDocId, (draft) => {
        draft.api_spec_blob_key = res.url // using URL as key; adjust if you map key separately
        draft.updated_at = new Date()
      })
      toast.success("Spec uploaded")
    } catch (err) {
      console.error(err)
      toast.error("Upload failed")
    } finally {
      setUploading(false)
    }
  }

  async function handleProcess() {
    if (!specText.trim()) {
      toast.error("Paste a spec first")
      return
    }
    setProcessing(true)
    try {
      // 1) Parse and dereference for a self-contained doc (faster client-side)
      const root = parseLooseOpenAPI(specText)
      const { schema, errors } = await dereference(root)
      if (errors?.length) {
        console.warn("OpenAPI dereference warnings/errors:", errors)
      }
      if (!schema || !schema.paths) {
        toast.error("No paths found in OpenAPI schema")
        return
      }

      // 2) Create child API docs (optimistic inserts + tRPC via onInsert)
      const now = new Date()
      const toCreate: Array<{
        title: string
        apiPath: string
        apiMethod: string
      }> = []

      for (const [apiPath, pathItem] of Object.entries(schema.paths)) {
        for (const m of METHODS) {
          const op = pathItem?.[m]
          if (!op) continue
          const title =
            (typeof op.summary === "string" && op.summary.trim()) ||
            (typeof op.operationId === "string" && op.operationId.trim()) ||
            `${m.toUpperCase()} ${apiPath}`
          toCreate.push({ title, apiPath, apiMethod: m.toUpperCase() })
        }
      }

      if (!toCreate.length) {
        toast.error("No operations to import")
        setProcessing(false)
        return
      }

      // Insert sequentially to keep UI stable; could be batched
      for (const item of toCreate) {
        const id =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`
        await docsCol.insert({
          id,
          organization_id: "", // Electric will backfill from shape; not required if shape returns orgId on select
          space_id: spaceId,
          parent_id: parentDocId,
          slug: "pending",
          title: item.title,
          icon_name: null,
          rank: "pending",
          type: "api",
          api_spec_blob_key: blobUrl ?? null,
          api_path: item.apiPath,
          api_method: item.apiMethod,
          archived_at: null,
          created_at: now,
          updated_at: now,
        })
      }

      toast.success(`Created ${toCreate.length} endpoints`)
    } catch (err) {
      console.error(err)
      toast.error("Processing failed")
    } finally {
      setProcessing(false)
    }
  }

  const currentBlobUrl = blobUrl || apiSpecBlobKey

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Import OpenAPI</h1>

      {apiSpecBlobKey && (
        <div className="p-3 border border-border rounded-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Existing OpenAPI spec found
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                You can load it for editing, reprocess it, or upload a new one.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={loadExistingSpec}
                disabled={loadingExistingSpec}
              >
                {loadingExistingSpec ? "Loading..." : "Load"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Paste JSON or YAML for OpenAPI 3.0 / 3.1. You can re-import anytime.
      </p>

      <Textarea
        className="min-h-[240px] max-h-[800px] overflow-y-auto"
        value={specText}
        onChange={(e) => setSpecText(e.target.value)}
        placeholder="Paste your OpenAPI docs here"
      />

      <div className="flex items-center gap-2">
        <Button onClick={handleUpload} disabled={uploading || !specText.trim()}>
          {uploading ? "Uploading…" : "Upload"}
        </Button>
        <Button
          variant="secondary"
          onClick={handleProcess}
          disabled={processing || !specText.trim()}
        >
          {processing ? "Processing…" : "Process"}
        </Button>
        {currentBlobUrl && (
          <a
            href={currentBlobUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs underline text-muted-foreground"
          >
            View uploaded spec
          </a>
        )}
      </div>
    </div>
  )
}
