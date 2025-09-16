import { createAuthClient } from "better-auth/react"
import { organizationClient } from "better-auth/client/plugins"
import {
  createCollection,
  localOnlyCollectionOptions,
} from "@tanstack/react-db"
import { z } from "zod"

const authStateSchema = z.object({
  id: z.string(),
  session: z.any().nullable(),
  user: z.any().nullable(),
})

export const authStateCollection = createCollection(
  localOnlyCollectionOptions({
    id: `auth-state`,
    getKey: (item) => item.id,
    schema: authStateSchema,
  })
)

// Fix: Properly handle SSR and client-side URL construction
function getBaseURL() {
  // Client-side: always use current origin
  if (typeof window !== "undefined") {
    return window.location.origin
  }

  // Server-side: use environment variable or default
  if (process.env.PUBLIC_URL) {
    return process.env.PUBLIC_URL
  }

  // Default for local development
  return "http://localhost:5173"
}

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  plugins: [organizationClient()],
})
