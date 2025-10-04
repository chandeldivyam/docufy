import { defineConfig } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteTsConfigPaths from "vite-tsconfig-paths"
import tailwindcss from "@tailwindcss/vite"
import { caddyPlugin } from "./src/vite-plugin-caddy"
import viteReact from "@vitejs/plugin-react"
import { nitroV2Plugin } from "@tanstack/nitro-v2-vite-plugin"
const config = defineConfig({
  server: {
    host: true,
  },
  plugins: [
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: [`./tsconfig.json`],
    }),
    // Local HTTPS with Caddy
    caddyPlugin(),
    tailwindcss(),
    tanstackStart({
      srcDirectory: "src",
      start: { entry: "./start.tsx" },
      server: { entry: "./server.ts" },
      spa: {
        enabled: true,
      },
    }),
    nitroV2Plugin({ preset: "node-server" }),
    viteReact(),
  ],
  ssr: {
    noExternal: ["zod", "inngest", "json-stringify-safe"],
  },
})

export default config
