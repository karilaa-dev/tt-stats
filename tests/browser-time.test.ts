import { describe, expect, it } from "vitest"

import { formatChartBucket, formatTimestamp } from "@/lib/browser-time"
import { isSnapshotStale } from "@/lib/stats/staleness"
import type { SnapshotMetadata } from "@/lib/stats/types"

describe("visitor timezone formatting", () => {
  const epoch = Date.parse("2026-08-12T00:00:00Z") / 1000

  it("renders the same epoch in UTC, New York, and Kathmandu", () => {
    expect(
      formatChartBucket(
        epoch,
        "24h",
        { locale: "en-US", timeZone: "UTC" },
        true
      )
    ).toContain("12:00 AM UTC")
    expect(
      formatChartBucket(
        epoch,
        "24h",
        { locale: "en-US", timeZone: "America/New_York" },
        true
      )
    ).toContain("08:00 PM EDT")
    expect(
      formatChartBucket(
        epoch,
        "24h",
        { locale: "en-US", timeZone: "Asia/Kathmandu" },
        true
      )
    ).toContain("05:45 AM GMT+5:45")
  })

  it("distinguishes repeated DST fallback hours", () => {
    const settings = { locale: "en-US", timeZone: "America/New_York" }
    const first = Date.parse("2025-11-02T05:30:00Z") / 1000
    const second = Date.parse("2025-11-02T06:30:00Z") / 1000
    expect(formatChartBucket(first, "24h", settings, true)).toContain("EDT")
    expect(formatChartBucket(second, "24h", settings, true)).toContain("EST")
  })

  it("includes years on all-time labels", () => {
    expect(
      formatChartBucket(epoch, "all", {
        locale: "en-US",
        timeZone: "UTC",
      })
    ).toContain("2026")
  })

  it("formats full timestamps without a hardcoded UTC suffix", () => {
    expect(
      formatTimestamp(epoch, {
        locale: "en-US",
        timeZone: "Asia/Kathmandu",
      })
    ).toContain("5:45:00 AM")
  })
})

describe("database snapshot staleness", () => {
  function snapshot(
    dataset: SnapshotMetadata["dataset"],
    refreshedAt: number
  ): SnapshotMetadata {
    return { dataset, refreshedAt, windowStartEpoch: 0, windowEndEpoch: 0 }
  }

  it("uses the database refresh timestamp for rolling and daily warnings", () => {
    const now = 2_000_000
    expect(isSnapshotStale(snapshot("rolling_24h", now - 901), now)).toBe(true)
    expect(isSnapshotStale(snapshot("rolling_24h", now - 900), now)).toBe(false)
    expect(isSnapshotStale(snapshot("daily", now - 129_601), now)).toBe(true)
    expect(isSnapshotStale(snapshot("daily", now - 129_600), now)).toBe(false)
  })
})
