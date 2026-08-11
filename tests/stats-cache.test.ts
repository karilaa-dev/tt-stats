import { describe, expect, it, vi } from "vitest"

import { PeriodicStatsCache } from "@/lib/stats/cache"

describe("periodic statistics cache", () => {
  it("deduplicates concurrent cold database queries", async () => {
    let calls = 0
    const cache = new PeriodicStatsCache({
      maxIdleMs: 10_000,
      refreshIntervalMs: 1_000,
    })
    const loader = async () => {
      calls += 1
      return { count: "42" }
    }

    const [first, second] = await Promise.all([
      cache.get("overview", loader),
      cache.get("overview", loader),
    ])

    expect(first).toEqual({ count: "42" })
    expect(second).toEqual(first)
    expect(calls).toBe(1)
  })

  it("serves stale data immediately while refreshing in the background", async () => {
    let now = 0
    let finishRefresh: ((value: string) => void) | undefined
    const cache = new PeriodicStatsCache({
      maxIdleMs: 10_000,
      now: () => now,
      refreshIntervalMs: 1_000,
    })

    expect(await cache.get("overview", async () => "first")).toBe("first")
    now = 1_001

    const stale = await cache.get(
      "overview",
      () =>
        new Promise<string>((resolve) => {
          finishRefresh = resolve
        })
    )
    expect(stale).toBe("first")

    finishRefresh?.("second")
    await cache.refreshActive(true)
    expect(await cache.get("overview", async () => "third")).toBe("second")
  })

  it("can force an immediate operator refresh", async () => {
    let now = 0
    let value = 0
    const cache = new PeriodicStatsCache({
      maxIdleMs: 10_000,
      now: () => now,
      refreshIntervalMs: 1_000,
    })
    const loader = async () => String(++value)

    expect(await cache.get("overview", loader)).toBe("1")
    now = 100
    await cache.refreshActive(true)
    expect(await cache.get("overview", loader)).toBe("2")
  })

  it("keeps the last successful result when a scheduled refresh fails", async () => {
    let now = 0
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {})
    const cache = new PeriodicStatsCache({
      maxIdleMs: 10_000,
      now: () => now,
      refreshIntervalMs: 1_000,
    })

    expect(await cache.get("overview", async () => "available")).toBe(
      "available"
    )
    now = 1_001
    await cache.get("overview", async () => {
      throw new Error("database unavailable")
    })
    await cache.refreshActive()

    expect(await cache.get("overview", async () => "next")).toBe("available")
    expect(errorLog).toHaveBeenCalled()
    errorLog.mockRestore()
  })
})
