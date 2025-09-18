import { createFileRoute, Link } from "@tanstack/react-router"

export const Route = createFileRoute("/_authenticated/$orgSlug/spaces/")({
  ssr: false,
  component: SpacesIndexPage,
})

function SpacesIndexPage() {
  const { orgSlug } = Route.useParams()
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Spaces</h1>
      <p className="text-muted-foreground mt-2">
        Pick a space from the sidebar or{" "}
        <Link to="/$orgSlug" params={{ orgSlug }} className="underline">
          go back
        </Link>
        .
      </p>
    </div>
  )
}
