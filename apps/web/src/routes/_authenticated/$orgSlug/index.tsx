import { createFileRoute } from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"

export const Route = createFileRoute("/_authenticated/$orgSlug/")({
  component: Home,
  ssr: false,
})

function Home() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Welcome</h1>
      <p className="text-muted-foreground mt-2">
        Active organization:{" "}
        <span className="font-medium">{activeOrg?.name}</span>
      </p>
    </div>
  )
}
