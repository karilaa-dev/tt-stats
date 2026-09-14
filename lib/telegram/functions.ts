import { requestWithCooldown } from "@/lib/http-client"
import { actions } from "astro:actions"
import type { TelegramChatProfile } from "@/lib/telegram/types"
export const getTelegramMau = () =>
  requestWithCooldown("read", () => actions.getTelegramMau.orThrow())
export const getTelegramChat = (chatId: string): Promise<TelegramChatProfile> =>
  requestWithCooldown("read", () => actions.getTelegramChat.orThrow({ chatId }))
