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
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="min-h-0 flex-grow overflow-auto 
        [&::-webkit-scrollbar]:w-1
        [&::-webkit-scrollbar-track]:bg-gray-100
        [&::-webkit-scrollbar-thumb]:bg-gray-300
        [&::-webkit-scrollbar-thumb]:rounded-full
        [&::-webkit-scrollbar-thumb:hover]:bg-gray-400
        dark:[&::-webkit-scrollbar-track]:bg-neutral-800
        dark:[&::-webkit-scrollbar-thumb]:bg-neutral-600
        dark:[&::-webkit-scrollbar-thumb:hover]:bg-neutral-500"
      >
        <CollaborativeEditor documentId={doc.id} orgSlug={orgSlug} />
      </div>
    </div>
  )
}
