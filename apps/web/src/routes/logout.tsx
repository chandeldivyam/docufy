import { createFileRoute, Navigate } from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"
import { usePostHog } from "posthog-js/react"
import { useEffect } from "react"

export const Route = createFileRoute("/logout")({
  component: () => <LogoutNow />,
  ssr: false,
})

function LogoutNow() {
  // fire and forget
  const posthog = usePostHog()

  useEffect(() => {
    // Reset PostHog user before signing out
    if (posthog) {
      posthog.reset()
    }
    // Then sign out
    authClient.signOut()
  }, [posthog])

  return <Navigate to="/login" replace />
}
