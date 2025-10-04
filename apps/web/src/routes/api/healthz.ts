import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/api/healthz")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json" },
        })
      },
    },
  },
})
