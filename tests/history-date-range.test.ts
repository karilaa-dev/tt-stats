import { describe, expect, it } from "vitest"
import { execFileSync } from "node:child_process"
import { historyDateRange } from "@/lib/history-date-range"

describe("history date range", () => {
  it("supports empty and open-ended ranges and rejects invalid dates", () => {
    expect(historyDateRange("", "")).toEqual({})
    expect(historyDateRange("2026-08-10", "")).toHaveProperty("from")
    expect(historyDateRange("", "2026-08-10")).toHaveProperty("until")
    for (const dates of [
      ["2026-02-30", ""],
      ["2026-13-01", ""],
      ["2000-01-01junk", ""],
      ["2026-08-11", "2026-08-10"],
    ]) {
      expect(historyDateRange(dates[0]!, dates[1]!)).toHaveProperty("error")
    }
  })
  it.each([
    [
      "America/Sao_Paulo",
      "2018-11-04",
      "2018-11-04T03:00:00Z",
      "2018-11-05T02:00:00Z",
    ],
    [
      "America/New_York",
      "2026-03-08",
      "2026-03-08T05:00:00Z",
      "2026-03-09T04:00:00Z",
    ],
    [
      "America/New_York",
      "2026-11-01",
      "2026-11-01T04:00:00Z",
      "2026-11-02T05:00:00Z",
    ],
    [
      "Asia/Kolkata",
      "2026-08-10",
      "2026-08-09T18:30:00Z",
      "2026-08-10T18:30:00Z",
    ],
    [
      "America/Los_Angeles",
      "2026-08-09",
      "2026-08-09T07:00:00Z",
      "2026-08-10T07:00:00Z",
    ],
  ])(
    "uses local calendar boundaries in %s on %s",
    (zone, date, from, until) => {
      // A fresh runtime prevents timezone changes in one test affecting another.
      const output = execFileSync(
        "bun",
        [
          "-e",
          `import { historyDateRange } from './lib/history-date-range.ts'; console.log(JSON.stringify(historyDateRange('${date}', '${date}')))`,
        ],
        {
          cwd: process.cwd(),
          env: { ...process.env, TZ: zone },
          encoding: "utf8",
        }
      )
      expect(JSON.parse(output)).toEqual({
        from: Date.parse(from) / 1000,
        until: Date.parse(until) / 1000,
      })
    }
  )
})
