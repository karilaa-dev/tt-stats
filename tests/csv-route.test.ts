import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ connect: vi.fn() }))

vi.mock("@/lib/db/pool", () => ({ connect: mocks.connect }))
vi.mock("@/lib/dev/fake-data", () => ({
  isFakeDataEnabled: () => true,
  getFakeHistory: () => [
    { Time: "2026-08-10T04:58:00.000Z", Video: "https://example.test/a" },
  ],
}))

import { getHistoryCsvResponse } from "@/lib/csv/history"

describe("public CSV route", () => {
  beforeEach(() => vi.clearAllMocks())

  it("rejects invalid IDs before touching the database", async () => {
    const response = await getHistoryCsvResponse("nope")
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Invalid user ID" })
    expect(mocks.connect).not.toHaveBeenCalled()
  })

  it("returns unguarded CSV with safe download headers", async () => {
    const response = await getHistoryCsvResponse("1")
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8")
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="user_1.csv"'
    )
    expect(await response.text()).toContain("https://example.test/a")
  })
})
