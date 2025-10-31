// apps/web/src/hooks/use-posthog-identify.ts
import { usePostHog } from "posthog-js/react"
import { useEffect, useRef } from "react"
import { authClient } from "@/lib/auth-client"

/**
 * Hook to identify users with PostHog when they sign in
 * Call this in your authenticated layout to track user sessions
 */
export function usePostHogIdentify() {
  const posthog = usePostHog()
  const { data: session } = authClient.useSession()
  const { data: activeOrg } = authClient.useActiveOrganization()

  // Track if we've already identified this session to avoid redundant calls
  const identifiedUserId = useRef<string | null>(null)
  const identifiedOrgId = useRef<string | null>(null)

  useEffect(() => {
    if (!posthog || !session?.user) {
      return
    }

    const userId = session.user.id
    const userEmail = session.user.email
    const userName = session.user.name

    // Only identify if we haven't already identified this user in this session
    if (identifiedUserId.current !== userId) {
      posthog.identify(userId, {
        email: userEmail,
        name: userName,
        // Add any other user properties you want to track
      })
      identifiedUserId.current = userId
    }

    // Group by organization if one is active
    if (activeOrg && identifiedOrgId.current !== activeOrg.id) {
      posthog.group("organization", activeOrg.id, {
        name: activeOrg.name,
        // Add other org properties if needed
      })
      identifiedOrgId.current = activeOrg.id
    }
  }, [posthog, session?.user, activeOrg])
}

/**
 * Hook to reset PostHog user on logout
 * Call this before signing out
 */
export function usePostHogReset() {
  const posthog = usePostHog()

  return () => {
    if (posthog) {
      posthog.reset()
    }
  }
}
