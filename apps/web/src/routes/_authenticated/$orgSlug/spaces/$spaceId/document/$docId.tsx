import { createFileRoute } from "@tanstack/react-router"
import { useLiveQuery } from "@tanstack/react-db"
import {
  getSpaceDocumentsCollection,
  emptyDocumentsCollection,
} from "@/lib/collections"
import { CollaborativeEditor } from "@/components/editor/CollaborativeEditor"
import { ApiSpecEditor } from "@/components/api/APISpecEditor"

export const Route = createFileRoute(
  "/_authenticated/$orgSlug/spaces/$spaceId/document/$docId"
)({
  ssr: false,
  component: DocumentPage,
})

function DocumentPage() {
  const { spaceId, docId, orgSlug } = Route.useParams()
  const docsCol = spaceId
    ? getSpaceDocumentsCollection(spaceId)
    : emptyDocumentsCollection
  const { data: docs } = useLiveQuery(
    (q) => q.from({ docs: docsCol }),
    [docsCol, docId]
  )
  const doc = docs?.find((d) => d.id === docId)

  if (!doc) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Loading document...
      </div>
    )
  }

  if (doc.type === "api_spec") {
    return (
      <ApiSpecEditor
        orgSlug={orgSlug}
        spaceId={spaceId}
        parentDocId={doc.id}
        apiSpecBlobKey={doc.api_spec_blob_key ?? ""}
      />
    )
  }

  if (doc.type === "api") {
    return (
      <div className="p-6 text-sm">
        <div className="text-muted-foreground">API endpoint</div>
        <div className="mt-2">doc id: {doc.id}</div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-grow overflow-auto">
        <CollaborativeEditor documentId={doc.id} orgSlug={orgSlug} />
      </div>
    </div>
  )
}
