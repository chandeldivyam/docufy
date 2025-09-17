import { createServerFileRoute } from "@tanstack/react-start/server"
import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { router } from "@/lib/trpc"
import { usersRouter } from "@/lib/trpc/users"
import { spacesRouter } from "@/lib/trpc/spaces"
import { db } from "@/db/connection"
import { auth } from "@/lib/auth"

export const appRouter = router({
  users: usersRouter,
  spaces: spacesRouter,
})

export type AppRouter = typeof appRouter

const serve = ({ request }: { request: Request }) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: async () => ({
      db,
      session: await auth.api.getSession({ headers: request.headers }),
    }),
  })
}

export const ServerRoute = createServerFileRoute("/api/trpc/$").methods({
  GET: serve,
  POST: serve,
})
