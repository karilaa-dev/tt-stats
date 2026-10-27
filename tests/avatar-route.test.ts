import type { APIContext } from "astro"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ principal: vi.fn(), avatar: vi.fn() }))
vi.mock("@/lib/auth/session", () => ({ getPrincipal: mocks.principal }))
vi.mock("@/lib/telegram/avatar", () => ({ getTelegramAvatar: mocks.avatar }))
vi.mock("@/lib/dev/fake-data", () => ({ isFakeDataEnabled: () => false }))
import { GET, HEAD } from "@/src/pages/api/users/[userId]/avatar"

function context(userId = "123") {
  return {
    params: { userId },
    cookies: {},
    request: new Request("http://localhost/avatar"),
  } as unknown as APIContext
}

describe("profile avatar access", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.avatar.mockResolvedValue(new Response("photo"))
  })
  it("allows the owner and admins", async () => {
    mocks.principal.mockResolvedValue({ user: { id: "123" }, admin: false })
    expect((await GET(context())).status).toBe(200)
    mocks.principal.mockResolvedValue({ user: { id: "456" }, admin: true })
    expect((await GET(context("-100123"))).status).toBe(200)
    expect(mocks.avatar).toHaveBeenCalledTimes(2)
  })
  it("rejects other users, visitors, invalid IDs, and HEAD without fetching a photo", async () => {
    for (const user of [null, { id: "456" }]) {
      mocks.principal.mockResolvedValue({ user, admin: false })
      expect((await GET(context())).status).toBe(404)
    }
    mocks.principal.mockResolvedValue({ user: { id: "123" }, admin: true })
    expect((await GET(context("invalid"))).status).toBe(404)
    expect((await HEAD(context())).status).toBe(405)
    expect(mocks.avatar).not.toHaveBeenCalled()
  })
})
