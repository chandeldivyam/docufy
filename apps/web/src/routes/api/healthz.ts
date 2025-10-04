import { createServerFileRoute } from "@tanstack/react-start/server"

export const ServerRoute = createServerFileRoute("/api/healthz").methods({
  GET: async () =>
    new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    }),
})
