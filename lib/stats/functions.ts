import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import {
  getFakeOtherStats,
  getFakeOverview,
  getFakeReferralStats,
  getFakeStatsBreakdown,
  getFakeTimeSeries,
  getFakeUserDownloads,
  getFakeUserStats,
  isFakeDataEnabled,
} from "@/lib/dev/fake-data"
import {
  getOtherStatsRaw,
  getOverviewRaw,
  getReferralStatsRaw,
  getStatsBreakdownRaw,
  getTimeSeriesRaw,
  getUserDownloadsRaw,
  getUserStatsRaw,
} from "@/lib/stats/queries"
import { CHAT_SCOPES, SERIES_METRICS, STATS_RANGES } from "@/lib/stats/types"

const statsRange = z.enum(STATS_RANGES)
const chatScope = z.enum(CHAT_SCOPES)
const seriesMetric = z.enum(SERIES_METRICS)
const telegramId = z.string().regex(/^-?\d+$/u)
const positivePage = z.number().int().positive()

export const getDashboardMeta = createServerFn({ method: "GET" }).handler(
  () => ({
    refreshedAt: Date.now(),
    fakeMode: isFakeDataEnabled(),
  })
)

export const getOverview = createServerFn({ method: "GET" }).handler(() =>
  isFakeDataEnabled() ? getFakeOverview() : getOverviewRaw()
)

export const getStatsBreakdown = createServerFn({ method: "GET" })
  .validator(z.object({ scope: chatScope, range: statsRange }))
  .handler(({ data }) =>
    isFakeDataEnabled()
      ? getFakeStatsBreakdown(data.scope, data.range)
      : getStatsBreakdownRaw(data.scope, data.range)
  )

export const getTimeSeries = createServerFn({ method: "GET" })
  .validator(z.object({ metric: seriesMetric, range: statsRange }))
  .handler(({ data }) =>
    isFakeDataEnabled()
      ? getFakeTimeSeries(data.metric, data.range)
      : getTimeSeriesRaw(data.metric, data.range)
  )

export const getReferralStats = createServerFn({ method: "GET" }).handler(() =>
  isFakeDataEnabled() ? getFakeReferralStats() : getReferralStatsRaw()
)

export const getOtherStats = createServerFn({ method: "GET" }).handler(() =>
  isFakeDataEnabled() ? getFakeOtherStats() : getOtherStatsRaw()
)

export const getUserStats = createServerFn({ method: "GET" })
  .validator(z.object({ userId: telegramId }))
  .handler(({ data }) =>
    isFakeDataEnabled()
      ? getFakeUserStats(data.userId)
      : getUserStatsRaw(data.userId)
  )

export const getUserDownloads = createServerFn({ method: "GET" })
  .validator(
    z.object({
      userId: telegramId,
      page: positivePage,
      pageSize: positivePage.max(50),
    })
  )
  .handler(({ data }) =>
    isFakeDataEnabled()
      ? getFakeUserDownloads(data.userId, data.page, data.pageSize)
      : getUserDownloadsRaw(data.userId, data.page, data.pageSize)
  )
