import { defineAction } from "astro:actions"
import { z } from "zod"
import { isFakeDataEnabled } from "@/lib/dev/fake-data"
import { getTelegramMauRaw } from "@/lib/telegram/mau"
import type { TelegramMau } from "@/lib/telegram/types"
import { getTelegramChatRaw } from "@/lib/telegram/chat"
import type { TelegramChatProfile } from "@/lib/telegram/types"

export const getTelegramChat = defineAction({
  input: z.object({ chatId: z.string().regex(/^-?\d{1,20}$/u) }),
  handler: ({ chatId }): TelegramChatProfile | Promise<TelegramChatProfile> => {
    if (isFakeDataEnabled()) {
      const group = chatId.startsWith("-")
      return {
        status: "available",
        id: chatId,
        type: group ? "supergroup" : "private",
        name: group ? "Demo group" : "Alex Example",
        username: group ? "demo_group" : "alex_example",
        demo: true,
      }
    }
    return getTelegramChatRaw(chatId)
  },
})

export const getTelegramMau = defineAction({
  handler: (): TelegramMau | Promise<TelegramMau> =>
    isFakeDataEnabled()
      ? { status: "available", count: 28430, checkedAt: Date.now(), demo: true }
      : getTelegramMauRaw(),
})
