import { describe, expect, it, vi } from "vitest"
import { createMauReader, mapTelegramMau } from "@/lib/telegram/mau"

const env = {
  BOT_TOKEN: "123:token",
  TELEGRAM_API_ID: "123",
  TELEGRAM_API_HASH: "a".repeat(32),
}
describe("Telegram MAU", () => {
  it("keeps unpublished counts distinct from zero", () => {
    expect(mapTelegramMau({}, 123)).toEqual({
      status: "not_published",
      count: null,
      checkedAt: 123,
    })
    expect(mapTelegramMau({ botActiveUsers: 0 }, 123)).toEqual({
      status: "available",
      count: 0,
      checkedAt: 123,
    })
    expect(() => mapTelegramMau({ botActiveUsers: -1 })).toThrow()
  })
  it("does not connect with missing or incomplete optional credentials", async () => {
    const fetcher = vi.fn()
    const read = createMauReader(fetcher)
    expect((await read({})).status).toBe("not_configured")
    expect((await read({ BOT_TOKEN: "old-bot-token" })).status).toBe(
      "not_configured"
    )
    expect((await read({ TELEGRAM_API_ID: "123" })).status).toBe(
      "configuration_error"
    )
    expect(fetcher).not.toHaveBeenCalled()
  })
  it("coalesces public requests and caches the result for 12 hours", async () => {
    let now = 0
    const fetcher = vi.fn(async () =>
      mapTelegramMau({ botActiveUsers: 321 }, now)
    )
    const read = createMauReader(fetcher, () => now)
    const results = await Promise.all([read(env), read(env), read(env)])
    expect(results.every((result) => result.count === 321)).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(1)
    now = 43_199_999
    await read(env)
    expect(fetcher).toHaveBeenCalledTimes(1)
    now = 43_200_000
    await read(env)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it("redacts failures and waits 12 hours before retrying", async () => {
    let now = 0
    const fetcher = vi.fn(async () => {
      throw new Error(env.BOT_TOKEN)
    })
    const read = createMauReader(fetcher, () => now)
    expect(await read(env)).toEqual({
      status: "unavailable",
      count: null,
      checkedAt: null,
    })
    now = 43_199_999
    await read(env)
    expect(fetcher).toHaveBeenCalledTimes(1)
    now = 43_200_000
    await read(env)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
