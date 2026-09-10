import { actions } from "astro:actions"
import type { TelegramChatProfile } from "@/lib/telegram/types"
export const getTelegramMau = () => actions.getTelegramMau.orThrow()
export const getTelegramChat = (chatId: string): Promise<TelegramChatProfile> =>
  actions.getTelegramChat.orThrow({ chatId })
