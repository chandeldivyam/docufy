import { createFileRoute } from "@tanstack/react-router"
import { useLiveQuery } from "@tanstack/react-db"
import {
  getSpaceDocumentsCollection,
  emptyDocumentsCollection,
} from "@/lib/collections"
import { CollaborativeEditor } from "@/components/editor/CollaborativeEditor"

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

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex-grow min-h-0">
        <CollaborativeEditor documentId={doc.id} orgSlug={orgSlug} />
      </div>
    </div>
  )
}
