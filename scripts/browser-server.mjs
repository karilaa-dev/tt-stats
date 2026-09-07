import { dev } from "astro"

// Run in the foreground even when Astro's CLI detects an agent environment.
const server = await dev({
  server: { host: "127.0.0.1", port: 4175 },
  vite: { cacheDir: ".astro/browser-vite" },
})
const stop = async () => {
  await server.stop()
  process.exit(0)
}
process.once("SIGINT", stop)
process.once("SIGTERM", stop)
