import { describe, expect, it } from "vitest"
import {
  dashboardSearchString,
  parseDashboardSearch,
} from "@/lib/dashboard-search"
import { queryKeys } from "@/lib/stats/query-keys"
import { getFakeStatsBreakdown } from "@/lib/dev/fake-data"

describe("platform breakdown navigation", () => {
  it("restores a platform together with the audience and reporting period", () => {
    const search = parseDashboardSearch(
      "?platform=instagram&scope=groups&range=31d"
    )
    expect(search).toMatchObject({
      platform: "instagram",
      scope: "groups",
      range: "31d",
    })
    expect(parseDashboardSearch(dashboardSearchString(search))).toEqual(search)
    expect(parseDashboardSearch("?platform=unknown").platform).toBe("all")
    expect(dashboardSearchString({ platform: "all" })).toBe("")
  })

  it("keeps platform results in separate browser cache entries", () => {
    const keys = ["all", "tiktok", "instagram"].map((platform) =>
      JSON.stringify(
        queryKeys.breakdown(
          "all",
          "24h",
          platform as "all" | "tiktok" | "instagram"
        )
      )
    )
    expect(new Set(keys).size).toBe(3)
    expect(queryKeys.breakdown("all", "24h")).toEqual(
      queryKeys.breakdown("all", "24h", "all")
    )
  })

  it("supplies distinct sample totals and attributes audio only to TikTok", () => {
    const all = getFakeStatsBreakdown("all", "24h")
    const tiktok = getFakeStatsBreakdown("all", "24h", "tiktok")
    const instagram = getFakeStatsBreakdown("all", "24h", "instagram")
    expect(BigInt(tiktok.downloads.total)).toBeLessThan(
      BigInt(all.downloads.total)
    )
    expect(BigInt(instagram.downloads.total)).toBeLessThan(
      BigInt(tiktok.downloads.total)
    )
    expect(instagram.music).toEqual({ total: "0", uniqueUsers: "0" })
    expect(tiktok.music).toEqual(all.music)
  })
})
