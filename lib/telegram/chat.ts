import "@/lib/server-only"
import { createHash } from "node:crypto"
import { z } from "zod"
import { TELEGRAM_CHAT_CACHE_MS, type TelegramChatProfile } from "./types"

const chatSchema = z.object({
  id: z.int(),
  type: z.enum(["private", "group", "supergroup", "channel"]),
  title: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z
    .string()
    .regex(/^[A-Za-z0-9_]+$/u)
    .optional(),
})

// Keep only display fields, never Telegram's full chat response or raw errors.
export function createChatReader(
  fetcher: (url: string, init: RequestInit) => Promise<Response> = fetch,
  now = Date.now
) {
  const cache = new Map<
    string,
    { value: TelegramChatProfile; expires: number }
  >()
  const pending = new Map<string, Promise<TelegramChatProfile>>()

  return async (
    chatId: string,
    token = process.env.BOT_TOKEN
  ): Promise<TelegramChatProfile> => {
    if (!/^-?\d{1,20}$/u.test(chatId)) return { status: "unavailable" }
    if (!token?.trim()) return { status: "not_configured" }
    const id = BigInt(chatId).toString()
    const key = `${createHash("sha256").update(token).digest("hex")}:${id}`
    const cached = cache.get(key)
    if (cached && cached.expires > now()) return cached.value
    const active = pending.get(key)
    if (active) return active

    const request = (async (): Promise<TelegramChatProfile> => {
      let value: TelegramChatProfile = { status: "unavailable" }
      let ttl = 60_000
      try {
        const response = await fetcher(
          `https://api.telegram.org/bot${token}/getChat`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: id }),
            signal: AbortSignal.timeout(8_000),
            cache: "no-store",
            redirect: "error",
          }
        )
        const body = await response.json()
        if (response.ok && body.ok === true) {
          const chat = chatSchema.parse(body.result)
          if (String(chat.id) !== id) throw new Error("Unexpected chat")
          value = {
            status: "available",
            id,
            type: chat.type,
            name:
              (chat.type === "private"
                ? [chat.first_name, chat.last_name].filter(Boolean).join(" ")
                : chat.title
              )?.trim() || null,
            username: chat.username ?? null,
          }
          ttl = TELEGRAM_CHAT_CACHE_MS
        } else if ([400, 403].includes(body.error_code ?? response.status)) {
          value = { status: "inaccessible" }
        } else if (response.status === 429) {
          const retryAfter = body.parameters?.retry_after
          if (Number.isSafeInteger(retryAfter) && retryAfter > 0) {
            ttl = Math.max(ttl, retryAfter * 1000)
          }
        }
      } catch {
        // Fetch errors can include the bot token in their URL. Do not expose them.
      }
      cache.delete(key)
      if (cache.size >= 500) cache.delete(cache.keys().next().value!)
      cache.set(key, { value, expires: now() + ttl })
      return value
    })()
    pending.set(key, request)
    try {
      return await request
    } finally {
      pending.delete(key)
    }
  }
}

export const getTelegramChatRaw = createChatReader()
