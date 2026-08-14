import { createServerFn } from "@tanstack/react-start"

import { getVideoMonitorEnv } from "@/lib/env"
import {
  buildTestNotification,
  deliverVideoNotification,
} from "@/lib/notifications/video-inactivity"

export interface VideoNotificationStatus {
  configured: boolean
  provider: "webhook" | "ntfy" | null
  configurationError: boolean
}

export const getVideoNotificationStatus = createServerFn({
  method: "GET",
}).handler((): VideoNotificationStatus => {
  try {
    const env = getVideoMonitorEnv()
    return {
      configured: env !== null,
      provider: env?.provider ?? null,
      configurationError: false,
    }
  } catch {
    return { configured: false, provider: null, configurationError: true }
  }
})

export const sendVideoNotificationTest = createServerFn({
  method: "POST",
}).handler(async () => {
  let env
  try {
    env = getVideoMonitorEnv()
  } catch {
    return {
      ok: false as const,
      message: "The video notification environment variables are invalid.",
    }
  }
  if (!env) {
    return {
      ok: false as const,
      message: "Configure a webhook or ntfy destination first.",
    }
  }
  try {
    await deliverVideoNotification(buildTestNotification(), env)
    return {
      ok: true as const,
      message: `Test notification sent through ${env.provider}.`,
    }
  } catch (error) {
    return {
      ok: false as const,
      message:
        error instanceof Error
          ? error.message
          : "The test notification could not be sent.",
    }
  }
})
