import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/_authenticated/$orgSlug/spaces/$spaceId/document/$docId"
)({
  ssr: false,
  component: DocPlaceholder,
})

function DocPlaceholder() {
  const { docId } = Route.useParams()
  return (
    <div className="p-6">
      <div className="text-muted-foreground">Document</div>
      <h2 className="text-xl font-semibold mt-2">{docId}</h2>
    </div>
  )
}
