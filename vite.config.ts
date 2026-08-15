import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import react from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

const allowedHosts = process.env.DEV_ALLOWED_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)
  .map((origin) => {
    try {
      return new URL(origin).hostname
    } catch {
      return origin
    }
  })

const videoInactivityPlugin = fileURLToPath(
  new URL("./server/plugins/video-inactivity-listener.ts", import.meta.url)
)

export default defineConfig({
  server: {
    port: 3000,
    allowedHosts,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [tailwindcss(), tanstackStart(), react(), nitro()],
  nitro: {
    plugins: [videoInactivityPlugin],
  },
})
