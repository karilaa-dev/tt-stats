import "@/lib/server-only"
import { createHash } from "node:crypto"
import { streamTelegramFile } from "@/lib/media/telegram"
import { TELEGRAM_CHAT_CACHE_MS } from "./types"

export function createAvatarReader(
  fetcher: (url: string, init?: RequestInit) => Promise<Response> = fetch,
  now = Date.now
) {
  const cache = new Map<string, { fileId: string | null; expires: number }>()
  const pending = new Map<string, Promise<string | null>>()
  return async (
    chatId: string,
    request: Request,
    token = process.env.BOT_TOKEN
  ) => {
    const missing = () =>
      new Response(null, {
        status: 404,
        headers: { "Cache-Control": "private, no-store" },
      })
    if (!token || !/^\d+:[A-Za-z0-9_-]+$/u.test(token)) return missing()
    const key = `${createHash("sha256").update(token).digest("hex")}:${chatId}`
    const cached = cache.get(key)
    let fileId = cached && cached.expires > now() ? cached.fileId : undefined
    try {
      if (fileId === undefined) {
        let lookup = pending.get(key)
        if (!lookup) {
          lookup = (async () => {
            const response = await fetcher(
              `https://api.telegram.org/bot${token}/getChat`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chatId }),
                signal: AbortSignal.timeout(8_000),
                cache: "no-store",
                redirect: "error",
              }
            )
            const body = await response.json()
            const photo = body.result?.photo?.small_file_id
            const value =
              response.ok &&
              body.ok === true &&
              String(body.result?.id) === chatId &&
              typeof photo === "string" &&
              photo
                ? photo
                : null
            cache.delete(key)
            if (cache.size >= 500) cache.delete(cache.keys().next().value!)
            cache.set(key, {
              fileId: value,
              expires: now() + (value ? TELEGRAM_CHAT_CACHE_MS : 60_000),
            })
            return value
          })()
          pending.set(key, lookup)
          void lookup.finally(() => pending.delete(key)).catch(() => {})
        }
        fileId = await lookup
      }
      if (!fileId) return missing()
      return await streamTelegramFile(
        { position: 0, media_type: "photo", file_id: fileId },
        request,
        token,
        fetcher
      )
    } catch {
      // Telegram request URLs contain the bot token. Never return raw errors.
      return missing()
    }
  }
}

export const getTelegramAvatar = createAvatarReader()
