import { Client } from "pg"
import { definePlugin } from "nitro"

import { isFakeDataEnabled } from "@/lib/dev/fake-data"
import { getDbEnv, getVideoMonitorEnv } from "@/lib/env"
import { checkVideoInactivity } from "@/lib/notifications/video-inactivity"

const CHANNEL = "tt_stats_video_inactivity_check"
const RECONNECT_DELAY_MS = 5_000

function safeCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code ?? "unknown")
    : "unknown"
}

export default definePlugin((nitroApp) => {
  if (isFakeDataEnabled()) return

  let notificationEnv
  try {
    notificationEnv = getVideoMonitorEnv()
  } catch {
    console.error("[video-inactivity] notification configuration is invalid")
    return
  }
  if (!notificationEnv) return

  let connectionString: string
  try {
    connectionString = getDbEnv().DB_URL
  } catch {
    console.error("[video-inactivity] database configuration is invalid")
    return
  }

  let listener: Client | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let connecting = false
  let closed = false

  const runCheck = async () => {
    try {
      await checkVideoInactivity({ env: notificationEnv })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown monitoring failure."
      console.error("[video-inactivity] check failed", { message })
    }
  }

  const scheduleReconnect = () => {
    if (closed || reconnectTimer) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      void connectListener()
    }, RECONNECT_DELAY_MS)
  }

  const connectListener = async () => {
    if (closed || connecting || listener) return
    connecting = true
    let candidate: Client | null = null
    try {
      const nextListener = new Client({
        connectionString,
        connectionTimeoutMillis: 10_000,
        application_name: "tt-stats-video-monitor",
        keepAlive: true,
      })
      candidate = nextListener
      nextListener.on("notification", (notification) => {
        if (notification.channel === CHANNEL) void runCheck()
      })
      nextListener.on("error", (error) => {
        console.error("[video-inactivity] listener error", {
          code: safeCode(error),
        })
        if (listener === nextListener) listener = null
        void nextListener.end().catch(() => undefined)
        scheduleReconnect()
      })
      nextListener.on("end", () => {
        if (listener === nextListener) listener = null
        scheduleReconnect()
      })
      await nextListener.connect()
      await nextListener.query(`LISTEN ${CHANNEL}`)
      listener = nextListener
      candidate = null
      void runCheck()
    } catch (error) {
      console.error("[video-inactivity] listener connection failed", {
        code: safeCode(error),
      })
      if (candidate) await candidate.end().catch(() => undefined)
      scheduleReconnect()
    } finally {
      connecting = false
    }
  }

  void connectListener()

  nitroApp.hooks.hook("close", async () => {
    closed = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = null
    const current = listener
    listener = null
    if (current) await current.end().catch(() => undefined)
  })
})
