import { afterEach, describe, expect, it, vi } from "vitest"
import {
  createUserSession,
  deleteUserSession,
  USER_COOKIE,
} from "@/lib/auth/session"
const queries = vi.hoisted(() => ({ stats: vi.fn(), downloads: vi.fn() }))
vi.mock("astro:actions", () => ({
  defineAction: (definition: unknown) => definition,
  ActionError: class extends Error {
    code: string
    constructor({ code, message }: { code: string; message: string }) {
      super(message)
      this.code = code
    }
  },
}))
vi.mock("@/lib/stats/queries", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getUserStatsRaw: queries.stats,
  getUserDownloadsRaw: queries.downloads,
}))
vi.mock("@/lib/dev/fake-data", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isFakeDataEnabled: () => false,
}))
import { getMyStats, getMyDownloads } from "@/src/actions/stats"
// defineAction is kept as its definition to exercise the real handlers and input schemas.
const stats = getMyStats as unknown as {
  handler: (input: unknown, context: unknown) => Promise<unknown>
}
const downloads = getMyDownloads as unknown as {
  handler: (input: unknown, context: unknown) => Promise<unknown>
  input: { safeParse: (value: unknown) => { success: boolean } }
}
afterEach(() => {
  vi.clearAllMocks()
})
describe("personal action authorization", () => {
  it("derives identity from the verified session and rejects a supplied user ID", async () => {
    const token = createUserSession({
      id: "123",
      name: "Owner",
      username: null,
    })
    const context = {
      cookies: {
        get: (name: string) =>
          name === USER_COOKIE ? { value: token } : undefined,
      },
    }
    queries.stats.mockResolvedValue({ userId: "123" })
    queries.downloads.mockResolvedValue({ items: [] })
    await stats.handler({ userId: "999" }, context)
    expect(queries.stats).toHaveBeenCalledWith("123")
    const input = { page: 1, pageSize: 20, range: "all", mediaKind: "all" }
    expect(downloads.input.safeParse({ ...input, userId: "999" }).success).toBe(
      false
    )
    await downloads.handler(input, context)
    expect(queries.downloads).toHaveBeenCalledWith(
      "123",
      1,
      20,
      undefined,
      input
    )
    deleteUserSession(token)
    await expect(stats.handler(undefined, context)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    })
  })
  it("does not query history for a forged session", async () => {
    const context = { cookies: { get: () => ({ value: "forged" }) } }
    await expect(
      downloads.handler({ page: 1, pageSize: 20 }, context)
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
    expect(queries.downloads).not.toHaveBeenCalled()
  })
})
