import { isFakeDataEnabled } from "@/lib/dev/fake-data"
import { getInstagramMonitorEnv } from "@/lib/env"
import { checkDeadInstagramAccounts } from "@/lib/notifications/instagram-dead"

export function startInstagramAccountMonitor():
  (() => Promise<void>) | undefined {
  if (isFakeDataEnabled()) return
  let env
  try {
    env = getInstagramMonitorEnv()
  } catch {
    console.error("[instagram-monitor] notification configuration is invalid")
    return
  }
  if (!env) return
  let running: Promise<void> | undefined
  let closed = false
  const check = () => {
    if (closed || running) return
    running = checkDeadInstagramAccounts({ env })
      .then(() => {})
      .catch(() =>
        console.error(
          "[instagram-monitor] check failed; verify source tables, permissions and ntfy configuration"
        )
      )
      .finally(() => {
        running = undefined
      })
  }
  check()
  const timer = setInterval(check, 60_000)
  timer.unref()
  return async () => {
    closed = true
    clearInterval(timer)
    await running
  }
}
