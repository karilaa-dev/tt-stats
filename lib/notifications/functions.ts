import { actions } from "astro:actions"

export interface VideoNotificationStatus {
  configured: boolean
  provider: "webhook" | "ntfy" | null
  configurationError: boolean
}

export const getVideoNotificationStatus = () =>
  actions.getVideoNotificationStatus.orThrow()

export const sendVideoNotificationTest = () =>
  actions.sendVideoNotificationTest.orThrow()
