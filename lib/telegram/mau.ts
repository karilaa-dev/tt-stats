import "@/lib/server-only"
import { createHash } from "node:crypto"
import { Api, TelegramClient } from "telegram"
import { StringSession } from "telegram/sessions/index.js"
import { Logger, LogLevel } from "telegram/extensions/Logger.js"
import { getTelegramEnv, type TelegramEnv } from "@/lib/env"
import { TELEGRAM_MAU_CHECK_INTERVAL_MS, type TelegramMau } from "./types"

export function mapTelegramMau(
  user: { botActiveUsers?: number },
  now = Date.now()
): TelegramMau {
  const count = user.botActiveUsers
  if (count === undefined)
    return { status: "not_published", count: null, checkedAt: now }
  if (!Number.isSafeInteger(count) || count < 0)
    throw new Error("Invalid MAU count")
  return { status: "available", count, checkedAt: now }
}

// Retain the authorization only in server memory. No user login or updates polling.
let savedSession = ""
async function fetchTelegramMau(env: TelegramEnv): Promise<TelegramMau> {
  const session = new StringSession(savedSession)
  const client = new TelegramClient(
    session,
    env.TELEGRAM_API_ID,
    env.TELEGRAM_API_HASH,
    {
      connectionRetries: 1,
      requestRetries: 3,
      autoReconnect: false,
      floodSleepThreshold: 0,
      baseLogger: new Logger(LogLevel.NONE),
    }
  )
  let timeout: ReturnType<typeof setTimeout> | undefined
  let cancelled = false
  const checkCancelled = () => {
    if (cancelled) throw new Error("Telegram timed out")
  }
  try {
    return await Promise.race([
      (async () => {
        try {
          await client.connect()
          checkCancelled()
          if (!savedSession) {
            await client.invoke(
              new Api.auth.ImportBotAuthorization({
                flags: 0,
                apiId: env.TELEGRAM_API_ID,
                apiHash: env.TELEGRAM_API_HASH,
                botAuthToken: env.BOT_TOKEN,
              })
            )
          }
          checkCancelled()
          const users = await client.invoke(
            new Api.InvokeWithoutUpdates({
              query: new Api.users.GetUsers({ id: [new Api.InputUserSelf()] }),
            })
          )
          checkCancelled()
          if (!Array.isArray(users)) throw new Error("Bot profile unavailable")
          const user = users[0]
          if (!(user instanceof Api.User) || !user.bot)
            throw new Error("Bot profile unavailable")
          savedSession = session.save()
          return mapTelegramMau(user)
        } finally {
          await client.destroy()
        }
      })(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          cancelled = true
          reject(new Error("Telegram timed out"))
        }, 15_000)
      }),
    ])
  } catch {
    savedSession = ""
    throw new Error("Telegram MAU is temporarily unavailable.")
  } finally {
    clearTimeout(timeout)
    await client.destroy()
  }
}

// Public requests share one read and cache, including failures, to bound API traffic.
export function createMauReader(fetcher = fetchTelegramMau, now = Date.now) {
  let cache: { value: TelegramMau; expires: number } | undefined
  let pending: Promise<TelegramMau> | undefined
  let configuration = ""
  return async (
    source: NodeJS.ProcessEnv = process.env
  ): Promise<TelegramMau> => {
    let env: TelegramEnv | null
    try {
      env = getTelegramEnv(source)
    } catch {
      return { status: "configuration_error", count: null, checkedAt: null }
    }
    if (!env) return { status: "not_configured", count: null, checkedAt: null }
    const key = createHash("sha256").update(JSON.stringify(env)).digest("hex")
    if (key !== configuration) {
      cache = undefined
      savedSession = ""
      configuration = key
    }
    if (cache && cache.expires > now()) return cache.value
    if (pending) return pending
    pending = (async () => {
      let value: TelegramMau
      try {
        value = await fetcher(env)
      } catch {
        value = { status: "unavailable", count: null, checkedAt: null }
      }
      cache = {
        value,
        expires: now() + TELEGRAM_MAU_CHECK_INTERVAL_MS,
      }
      return value
    })()
    try {
      return await pending
    } finally {
      pending = undefined
    }
  }
}

export const getTelegramMauRaw = createMauReader()
