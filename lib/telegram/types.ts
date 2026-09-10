export const TELEGRAM_MAU_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000

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
