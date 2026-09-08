import { defineConfig } from "astro/config"
import node from "@astrojs/node"
import react from "@astrojs/react"
import tailwindcss from "@tailwindcss/vite"
import { loadEnv } from "vite"
import { buildMonitor } from "./scripts/build-monitor.mjs"

for (const [key, value] of Object.entries(
  loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "")
)) {
  if (process.env[key] === undefined) process.env[key] = value
}
const allowedHosts = process.env.DEV_ALLOWED_ORIGINS?.split(",")
  .map((value) => {
    try {
      return new URL(value.trim()).hostname
    } catch {
      return value.trim()
    }
  })
  .filter(Boolean)
let stopMonitor

export default defineConfig({
  site: "https://tt-stats.karilaa.dev",
  security: {
    // Dokploy terminates HTTPS before forwarding requests to the Bun server.
    allowedDomains: [{ protocol: "https", hostname: "tt-stats.karilaa.dev" }],
  },
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [
    react(),
    {
      name: "tt-stats-video-monitor",
      hooks: {
        "astro:server:start": async () => {
          await buildMonitor(".astro/dev-monitor.mjs")
          const { startVideoInactivityMonitor } = await import(
            `./.astro/dev-monitor.mjs?t=${Date.now()}`
          )
          stopMonitor = startVideoInactivityMonitor()
        },
        "astro:server:done": async () => {
          await stopMonitor?.()
        },
      },
    },
  ],
  server: { host: "0.0.0.0", port: 3000, allowedHosts },
  vite: {
    plugins: [
      tailwindcss(),
      {
        name: "tt-stats-server-only",
        load(id, options) {
          if (id.endsWith("/lib/server-only.ts") && !options?.ssr) {
            throw new Error(
              "A server-only TT Stats module was imported by browser code."
            )
          }
        },
      },
    ],
  },
})
