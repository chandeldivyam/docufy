import { createFileRoute } from "@tanstack/react-router"
import { useLiveQuery } from "@tanstack/react-db"
import {
  getSpaceDocumentsCollection,
  emptyDocumentsCollection,
} from "@/lib/collections"

export const Route = createFileRoute(
  "/_authenticated/$orgSlug/spaces/$spaceId/document/$docId"
)({
  ssr: false,
  component: DocPlaceholder,
})

function DocPlaceholder() {
  const { spaceId, docId } = Route.useParams()
  const docsCol = spaceId
    ? getSpaceDocumentsCollection(spaceId)
    : emptyDocumentsCollection
  const { data: docs } = useLiveQuery(
    (q) => q.from({ docs: docsCol }),
    [docsCol]
  )
  const doc = docs?.find((d) => d.id === docId)

  if (!doc) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Document not found or deleted
      </div>
    )
  }

  return (
    <div className="p-6 space-y-2">
      <div className="text-muted-foreground">Document</div>
      <h2 className="text-xl font-semibold">{doc.title}</h2>
      <div className="text-xs text-muted-foreground">id: {doc.id}</div>
    </div>
  )
}
