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
  const { spaceId, docId } = Route.useParams()
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
      <header className="p-4 border-b">
        {/* You can add your title editing component here, which uses docsCol.update() */}
        <h1 className="text-2xl font-semibold">{doc.title}</h1>
      </header>
      <div className="flex-grow min-h-0">
        <CollaborativeEditor documentId={doc.id} />
      </div>
    </div>
  )
}
