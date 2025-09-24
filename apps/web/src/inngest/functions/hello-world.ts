import { inngest } from "../client"

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "app/hello" },
  async ({ event, step }) => {
    await step.sleep("demo-wait", "1s")
    return { message: `Hello ${event.data?.name ?? "world"}!` }
  }
)
