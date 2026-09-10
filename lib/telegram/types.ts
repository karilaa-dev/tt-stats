export const TELEGRAM_MAU_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000

export const TELEGRAM_CHAT_CACHE_MS = 60 * 60 * 1000

export type TelegramChatProfile =
  | {
      status: "available"
      id: string
      type: "private" | "group" | "supergroup" | "channel"
      name: string | null
      username: string | null
      demo?: boolean
    }
  | { status: "not_configured" | "inaccessible" | "unavailable" }

export interface TelegramMau {
  status:
    | "available"
    | "not_configured"
    | "not_published"
    | "unavailable"
    | "configuration_error"
  count: number | null
  checkedAt: number | null
  demo?: boolean
}
