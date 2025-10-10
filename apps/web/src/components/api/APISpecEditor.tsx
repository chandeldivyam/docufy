// ./apps/web/src/components/api/ApiSpecEditor.tsx
import { useMemo, useState, useEffect } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { uploadFileToBlob } from "@/lib/blob-uploader"
import { getSpaceDocumentsCollection } from "@/lib/collections"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc-client"

type Props = {
  orgSlug: string
  spaceId: string
  parentDocId: string // the api_spec document whose children we'll create
  apiSpecBlobKey: string | null | undefined
}

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
      const res = await trpc.documents.importOpenApi.mutate({
        parentId: parentDocId,
        spaceId,
        specText, // send the pasted text; server parses & dereferences
        // blobUrl: currentBlobUrl (optional future use)
      })
      toast.success(
        `Imported ${res.endpoints} endpoints across ${res.tags} tags`
      )
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
