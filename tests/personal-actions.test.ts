vi.mock("@/lib/auth/store", () => import("./auth-store-fixture"))
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  createUserSession,
  deleteUserSession,
  USER_COOKIE,
} from "@/lib/auth/session"
const queries = vi.hoisted(() => ({
  stats: vi.fn(),
  downloads: vi.fn(),
  activity: vi.fn(),
}))
vi.mock("@/lib/stats/cached", () => ({
  getCachedUserActivity: queries.activity,
  getCachedUserStats: queries.stats,
  getCachedUserDownloads: queries.downloads,
}))
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
import {
  getMyStats,
  getMyDownloads,
  getMyActivity,
  getUserActivity,
} from "@/src/actions/stats"
// defineAction is kept as its definition to exercise the real handlers and input schemas.
const stats = getMyStats as unknown as {
  handler: (input: unknown, context: unknown) => Promise<unknown>
}
const downloads = getMyDownloads as unknown as {
  handler: (input: unknown, context: unknown) => Promise<unknown>
  input: { safeParse: (value: unknown) => { success: boolean } }
}
const activity = getMyActivity as unknown as typeof downloads
const arbitraryActivity = getUserActivity as unknown as typeof downloads
afterEach(() => {
  vi.clearAllMocks()
})
describe("personal action authorization", () => {
  it("validates custom history bounds and discovery options", () => {
    const input = {
      page: 1,
      pageSize: 20,
      mediaKind: "all",
      discovery: "others",
      sort: "popular",
      from: 1786226400,
      until: 1786312800,
    }
    expect(downloads.input.safeParse(input).success).toBe(true)
    for (const extra of [
      { until: input.from },
      { until: input.from - 1 },
      { from: 1.5 },
      { from: -1 },
      { until: Infinity },
      { discovery: "all; DROP TABLE videos" },
      { sort: "downloads" },
      { range: "24h" },
    ]) {
      expect(downloads.input.safeParse({ ...input, ...extra }).success).toBe(
        false
      )
    }
  })
  it("derives identity from the verified session and rejects a supplied user ID", async () => {
    const token = await createUserSession({
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
    queries.activity.mockResolvedValue({ interval: "month", points: [] })
    await stats.handler({ userId: "999" }, context)
    expect(queries.stats).toHaveBeenCalledWith("123")
    expect(
      activity.input.safeParse({ range: "all", userId: "999" }).success
    ).toBe(false)
    await activity.handler({ range: "all" }, context)
    expect(queries.activity).toHaveBeenCalledWith("123", "all")
    await expect(
      arbitraryActivity.handler({ range: "all", userId: "999" }, context)
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
    const input = {
      page: 1,
      pageSize: 20,
      mediaKind: "all",
      discovery: "first",
      sort: "popular",
      from: 1786226400,
      until: 1786312800,
    }
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
    await deleteUserSession(token)
    await expect(
      stats.handler(undefined, { cookies: { ...context.cookies } })
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    })
  })
  it("does not query history for a forged session", async () => {
    const context = { cookies: { get: () => ({ value: "forged" }) } }
    await expect(
      downloads.handler({ page: 1, pageSize: 20 }, context)
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
    expect(queries.downloads).not.toHaveBeenCalled()
    await expect(
      activity.handler({ range: "all" }, context)
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
    expect(queries.activity).not.toHaveBeenCalled()
  })
})
