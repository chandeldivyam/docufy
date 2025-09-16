import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"

export const Route = createFileRoute("/_authenticated")({
  ssr: false, // rely on client session hook for now
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return <div className="p-8 text-muted-foreground">Checking session…</div>
  }
  if (!session) {
    const redirect = typeof window !== "undefined" ? window.location.href : "/"
    return <Navigate to="/login" search={{ redirect }} replace />
  }

  return <Outlet />
}
