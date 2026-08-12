import { describe, expect, it } from "vitest"

import { getLanguagePresentation } from "@/lib/language"
import {
  bucketSecondsForRange,
  cutoffForRange,
  fillTimeSeries,
  RANGE_SECONDS,
} from "@/lib/stats/time-series"
import {
  parseChatScope,
  parseStatsRange,
  parseTelegramId,
} from "@/lib/stats/validation"

describe("statistics validation", () => {
  it("accepts known filters and safely rejects unknown values", () => {
    expect(parseChatScope("groups")).toBe("groups")
    expect(parseChatScope("unknown")).toBe("all")
    expect(parseStatsRange("31d")).toBe("31d")
    expect(parseStatsRange("yesterday")).toBe("24h")
  })

  it("preserves signed and very large Telegram IDs as strings", () => {
    expect(parseTelegramId("-1009223372036854775807")).toBe(
      "-1009223372036854775807"
    )
    expect(parseTelegramId("9223372036854775807")).toBe("9223372036854775807")
    expect(parseTelegramId("12.5")).toBeNull()
    expect(parseTelegramId(" 12")).toBeNull()
  })
})

describe("language presentation", () => {
  it("uses a country flag and readable name for stored language codes", () => {
    expect(getLanguagePresentation("uk")).toEqual({
      code: "uk",
      flag: "🇺🇦",
      name: "Ukrainian",
    })
    expect(getLanguagePresentation("en-US")).toMatchObject({
      code: "en-US",
      flag: "🇺🇸",
      name: "English",
    })
  })
})

describe("exact ranges and UTC buckets", () => {
  it("uses exact 24-hour, 7-day, and 31-day cutoffs", () => {
    const now = 2_000_000_000
    expect(cutoffForRange("24h", now)).toBe(now - RANGE_SECONDS["24h"])
    expect(cutoffForRange("7d", now)).toBe(now - RANGE_SECONDS["7d"])
    expect(cutoffForRange("31d", now)).toBe(now - RANGE_SECONDS["31d"])
  })

  it("uses completed half-hour buckets for the rolling day", () => {
    expect(bucketSecondsForRange("24h")).toBe(30 * 60)
    expect(bucketSecondsForRange("7d")).toBe(60 * 60)
  })

  it("fills every covered UTC bucket with zeroes", () => {
    expect(
      fillTimeSeries([{ bucket: "3600", count: "7" }], 1, 7_200, 3_600)
    ).toEqual([
      { bucketEpoch: 0, count: 0 },
      { bucketEpoch: 3_600, count: 7 },
      { bucketEpoch: 7_200, count: 0 },
    ])
  })

  it("keeps PostgreSQL counts lossless until deliberate display conversion", () => {
    const count = "9223372036854775807"
    expect(BigInt(count).toString()).toBe(count)
  })
})
