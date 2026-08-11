import { queryOptions } from "@tanstack/react-query"

import {
  getOtherStats,
  getOverview,
  getReferralStats,
  getStatsBreakdown,
  getTimeSeries,
  getUserDownloads,
  getUserStats,
} from "@/lib/stats/functions"
import type { ChatScope, SeriesMetric, StatsRange } from "@/lib/stats/types"

export const statsQueryKey = ["stats"] as const
const STALE_TIME = 5 * 60 * 1000

export function overviewQueryOptions() {
  return queryOptions({
    queryKey: [...statsQueryKey, "overview"],
    queryFn: () => getOverview(),
    staleTime: STALE_TIME,
  })
}

export function statsBreakdownQueryOptions(
  scope: ChatScope,
  range: StatsRange
) {
  return queryOptions({
    queryKey: [...statsQueryKey, "breakdown", scope, range],
    queryFn: () => getStatsBreakdown({ data: { scope, range } }),
    staleTime: STALE_TIME,
  })
}

export function timeSeriesQueryOptions(
  metric: SeriesMetric,
  range: StatsRange
) {
  return queryOptions({
    queryKey: [...statsQueryKey, "time-series", metric, range],
    queryFn: () => getTimeSeries({ data: { metric, range } }),
    staleTime: STALE_TIME,
  })
}

export function referralStatsQueryOptions() {
  return queryOptions({
    queryKey: [...statsQueryKey, "referrals"],
    queryFn: () => getReferralStats(),
    staleTime: STALE_TIME,
  })
}

export function otherStatsQueryOptions() {
  return queryOptions({
    queryKey: [...statsQueryKey, "other"],
    queryFn: () => getOtherStats(),
    staleTime: STALE_TIME,
  })
}

export function userStatsQueryOptions(userId: string) {
  return queryOptions({
    queryKey: [...statsQueryKey, "user", userId],
    queryFn: () => getUserStats({ data: { userId } }),
    staleTime: STALE_TIME,
  })
}

export function userDownloadsQueryOptions(
  userId: string,
  page: number,
  pageSize: number
) {
  return queryOptions({
    queryKey: [...statsQueryKey, "user", userId, "downloads", page, pageSize],
    queryFn: () => getUserDownloads({ data: { userId, page, pageSize } }),
    staleTime: STALE_TIME,
  })
}
