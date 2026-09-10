import { queryOptions } from "@tanstack/react-query"
import { getTelegramChat, getTelegramMau } from "@/lib/telegram/functions"
import {
  TELEGRAM_CHAT_CACHE_MS,
  TELEGRAM_MAU_CHECK_INTERVAL_MS,
} from "@/lib/telegram/types"

export function telegramChatQueryOptions(chatId: string) {
  return queryOptions({
    queryKey: ["telegram-chat", chatId],
    queryFn: () => getTelegramChat(chatId),
    staleTime: (query) =>
      query.state.data?.status === "available"
        ? TELEGRAM_CHAT_CACHE_MS
        : 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
}

export function telegramMauQueryOptions() {
  return queryOptions({
    queryKey: ["telegram-mau"],
    queryFn: getTelegramMau,
    staleTime: TELEGRAM_MAU_CHECK_INTERVAL_MS,
    refetchInterval: TELEGRAM_MAU_CHECK_INTERVAL_MS,
    retry: false,
  })
}
