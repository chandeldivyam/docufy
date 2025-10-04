// apps/web/src/routes/api/hello.ts
import { createFileRoute } from "@tanstack/react-router"
import { inngest } from "@/inngest"

export const Route = createFileRoute("/api/hello")({
  server: {
    handlers: {
      GET: async () => {
        await inngest.send({
          name: "app/hello",
          data: { name: "TanStack + Inngest" },
        })
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json" },
        })
      },
    },
  },
})
