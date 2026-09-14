import { createHash } from "node:crypto"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ThemeProvider } from "next-themes"
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
const site = new URL(process.env.APP_ORIGIN || "https://tt-stats.karilaa.dev")
let stopMonitor

export default defineConfig({
  site: site.origin,
  security: {
    actionBodySizeLimit: 16_384,
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self' data:",
        "media-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      styleDirective: { resources: ["'self'", "'unsafe-inline'"] },
      scriptDirective: {
        resources: ["'self'"],
        hashes: Array.from(
          renderToStaticMarkup(
            createElement(ThemeProvider, {
              attribute: "class",
              defaultTheme: "system",
              enableSystem: true,
              disableTransitionOnChange: true,
            })
          ).matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g),
          (match) =>
            `sha256-${createHash("sha256").update(match[1]).digest("base64")}`
        ),
      },
    },
    // Dokploy terminates HTTPS before forwarding requests to the Bun server.
    allowedDomains: [
      {
        protocol: site.protocol.slice(0, -1),
        hostname: site.hostname,
        ...(site.port ? { port: site.port } : {}),
      },
    ],
  },
  markdown: { syntaxHighlight: "prism" },
  output: "server",
  adapter: node({ mode: "standalone", bodySizeLimit: 16_384 }),
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
