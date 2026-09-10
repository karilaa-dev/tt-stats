import { defineAction } from "astro:actions"
import { isFakeDataEnabled } from "@/lib/dev/fake-data"
import { getTelegramMauRaw } from "@/lib/telegram/mau"
import type { TelegramMau } from "@/lib/telegram/types"

export const getTelegramMau = defineAction({
  handler: (): TelegramMau | Promise<TelegramMau> =>
    isFakeDataEnabled()
      ? { status: "available", count: 28430, checkedAt: Date.now(), demo: true }
      : getTelegramMauRaw(),
})
