import { queryOptions } from "@tanstack/react-query"
import { getTelegramMau } from "@/lib/telegram/functions"
import { TELEGRAM_MAU_CHECK_INTERVAL_MS } from "@/lib/telegram/types"

export function telegramMauQueryOptions() {
  return queryOptions({
    queryKey: ["telegram-mau"],
    queryFn: getTelegramMau,
    staleTime: TELEGRAM_MAU_CHECK_INTERVAL_MS,
    refetchInterval: TELEGRAM_MAU_CHECK_INTERVAL_MS,
    retry: false,
  })
}
