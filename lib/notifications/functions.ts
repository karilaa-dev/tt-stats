import { requestWithCooldown } from "@/lib/http-client"
import { actions } from "astro:actions"

export interface VideoNotificationStatus {
  configured: boolean
  provider: "webhook" | "ntfy" | null
  configurationError: boolean
}

export const getVideoNotificationStatus = () =>
  requestWithCooldown("read", () =>
    actions.getVideoNotificationStatus.orThrow()
  )

export const sendVideoNotificationTest = () =>
  requestWithCooldown("read", () => actions.sendVideoNotificationTest.orThrow())
