// apps/web/src/routes/api/hello.ts
import { createServerFileRoute } from "@tanstack/react-start/server"
import { inngest } from "@/inngest"

export const ServerRoute = createServerFileRoute("/api/hello").methods({
  GET: async () => {
    await inngest.send({
      name: "app/hello",
      data: { name: "TanStack + Inngest" },
    })
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    })
  },
})
