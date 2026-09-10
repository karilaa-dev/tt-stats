import { dev } from "astro"

// Run in the foreground even when Astro's CLI detects an agent environment.
const server = await dev({
  devToolbar: { enabled: false },
  server: { host: "127.0.0.1", port: 4175 },
  vite: {
    cacheDir: ".astro/browser-vite",
    // Scan every island before tests navigate, avoiding optimizer reloads mid-test.
    optimizeDeps: { entries: ["components/**/*.tsx"] },
  },
})
const stop = async () => {
  await server.stop()
  process.exit(0)
}
process.once("SIGINT", stop)
process.once("SIGTERM", stop)
