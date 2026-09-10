import { describe, expect, it, vi } from "vitest"
import { createChatReader } from "@/lib/telegram/chat"
import { TELEGRAM_CHAT_CACHE_MS } from "@/lib/telegram/types"

const token = "123:test-token"
const privateChat = {
  id: 123,
  type: "private",
  first_name: "Alex",
  last_name: "Example",
  username: "alex_example",
}
const reply = (result: object) => Response.json({ ok: true, result })

describe("Telegram chat lookup", () => {
  it("reads a private name and username, keeping only display fields", async () => {
    const fetcher = vi.fn(async () =>
      reply({
        ...privateChat,
        bio: "Not returned",
        invite_link: "Not returned",
      })
    )
    expect(await createChatReader(fetcher)("123", token)).toEqual({
      status: "available",
      id: "123",
      type: "private",
      name: "Alex Example",
      username: "alex_example",
    })
    expect(fetcher).toHaveBeenCalledWith(
      `https://api.telegram.org/bot${token}/getChat`,
      expect.objectContaining({
        method: "POST",
        body: '{"chat_id":"123"}',
        cache: "no-store",
        redirect: "error",
        signal: expect.any(AbortSignal),
      })
    )
  })

  it.each(["group", "supergroup", "channel"])(
    "reads a %s title without requiring a username",
    async (type) => {
      const read = createChatReader(
        vi.fn(async () => reply({ id: -100123, type, title: "Our chat" }))
      )
      expect(await read("-100123", token)).toEqual({
        status: "available",
        id: "-100123",
        type,
        name: "Our chat",
        username: null,
      })
    }
  )

  it("does not connect without credentials or with malformed IDs", async () => {
    const fetcher = vi.fn()
    const read = createChatReader(fetcher)
    expect(await read("123", "")).toEqual({ status: "not_configured" })
    expect(await read("@alex", token)).toEqual({ status: "unavailable" })
    expect(await read("9".repeat(21), token)).toEqual({ status: "unavailable" })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("coalesces reads and caches per chat and bot for one hour", async () => {
    let now = 0
    const fetcher = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) =>
        reply({
          ...privateChat,
          id: Number(JSON.parse(String(init?.body)).chat_id),
        })
    )
    const read = createChatReader(fetcher, () => now)
    await Promise.all([
      read("123", token),
      read("123", token),
      read("00123", token),
    ])
    expect(fetcher).toHaveBeenCalledTimes(1)
    now = TELEGRAM_CHAT_CACHE_MS - 1
    await read("123", token)
    expect(fetcher).toHaveBeenCalledTimes(1)
    now++
    await read("123", token)
    await read("456", token)
    await read("123", "456:different-token")
    expect(fetcher).toHaveBeenCalledTimes(4)
  })

  it.each([400, 403])(
    "handles inaccessible chats with HTTP %i",
    async (status) => {
      const read = createChatReader(
        vi.fn(async () =>
          Response.json(
            {
              ok: false,
              error_code: status,
              description: "private upstream detail",
            },
            { status }
          )
        )
      )
      expect(await read("123", token)).toEqual({ status: "inaccessible" })
    }
  )

  it("redacts network errors and retries after the shorter failure cache expires", async () => {
    let now = 0
    const fetcher = vi.fn(async () => {
      throw new Error(`https://api.telegram.org/bot${token}`)
    })
    const read = createChatReader(fetcher, () => now)
    expect(await read("123", token)).toEqual({ status: "unavailable" })
    now = 59_999
    await read("123", token)
    expect(fetcher).toHaveBeenCalledTimes(1)
    now++
    await read("123", token)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it.each([
    { ...privateChat, id: 456 },
    { ...privateChat, id: Number.MAX_SAFE_INTEGER + 1 },
    { ...privateChat, username: "example/path?query" },
    { ...privateChat, type: "unexpected" },
  ])("rejects malformed or mismatched chat data", async (chat) => {
    expect(
      await createChatReader(vi.fn(async () => reply(chat)))("123", token)
    ).toEqual({ status: "unavailable" })
  })

  it("honors Telegram's retry delay for a rate-limited chat", async () => {
    let now = 0
    const fetcher = vi.fn(async () =>
      Response.json(
        { ok: false, parameters: { retry_after: 120 } },
        { status: 429 }
      )
    )
    const read = createChatReader(fetcher, () => now)
    await read("123", token)
    now = 119_999
    await read("123", token)
    expect(fetcher).toHaveBeenCalledTimes(1)
    now++
    await read("123", token)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
