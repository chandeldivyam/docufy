import { createFileRoute, Navigate } from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"

export const Route = createFileRoute("/logout")({
  component: () => <LogoutNow />,
  ssr: false,
})

function LogoutNow() {
  // fire and forget
  authClient.signOut()
  return <Navigate to="/login" replace />
}
