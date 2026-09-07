import { startVideoInactivityMonitor } from "../dist/monitor.mjs"
const stopMonitor = startVideoInactivityMonitor()
const shutdown = async () => {
  await stopMonitor?.()
  process.exit(0)
}
process.once("SIGINT", shutdown)
process.once("SIGTERM", shutdown)
await import("../dist/server/entry.mjs")
