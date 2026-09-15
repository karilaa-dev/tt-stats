import { ensureWebsiteSchema, cleanWebsiteStorage } from "@/lib/db/website"
import { validateRuntimeConfiguration } from "@/lib/env"
import { isFakeDataEnabled } from "@/lib/dev/fake-data"
import { startVideoInactivityMonitor } from "./plugins/video-inactivity-listener"
export { startVideoInactivityMonitor }
export async function startRuntime() {
  if (isFakeDataEnabled()) return async () => {}
  validateRuntimeConfiguration()
  await ensureWebsiteSchema()
  let cleaning: Promise<void> | undefined
  const clean = () => {
    if (!cleaning)
      cleaning = cleanWebsiteStorage()
        .catch(() => console.error("[website] storage cleanup failed"))
        .finally(() => {
          cleaning = undefined
        })
  }
  clean()
  const timer = setInterval(clean, 300_000)
  timer.unref()
  const stopMonitor = startVideoInactivityMonitor()
  return async () => {
    clearInterval(timer)
    await cleaning
    await stopMonitor?.()
  }
}
