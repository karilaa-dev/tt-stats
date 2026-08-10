import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ hasValidSession: vi.fn() }))

vi.mock("@/lib/auth/session", () => ({
  hasValidSession: mocks.hasValidSession,
}))

import { GET } from "@/app/api/users/[userId]/history.csv/route"

describe("CSV route authorization", () => {
  beforeEach(() => vi.clearAllMocks())

  it("rejects unauthenticated downloads before touching the database", async () => {
    mocks.hasValidSession.mockResolvedValue(false)
    const response = await GET(
      new Request("http://localhost/api/users/1/history.csv"),
      { params: Promise.resolve({ userId: "1" }) }
    )
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "Unauthorized" })
  })

  it("rejects invalid IDs after revalidating the session", async () => {
    mocks.hasValidSession.mockResolvedValue(true)
    const response = await GET(
      new Request("http://localhost/api/users/nope/history.csv"),
      { params: Promise.resolve({ userId: "nope" }) }
    )
    expect(response.status).toBe(400)
    expect(mocks.hasValidSession).toHaveBeenCalledOnce()
  })
})
