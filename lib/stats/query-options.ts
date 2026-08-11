import { keepPreviousData, queryOptions } from "@tanstack/react-query"

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
const AGGREGATE_STALE_TIME = 30 * 1000
const CLIENT_REFRESH_INTERVAL = 60 * 1000
const USER_STALE_TIME = 60 * 1000

const backgroundRefreshOptions = {
  placeholderData: keepPreviousData,
  refetchInterval: CLIENT_REFRESH_INTERVAL,
  staleTime: AGGREGATE_STALE_TIME,
} as const

export function overviewQueryOptions() {
  return queryOptions({
    queryKey: [...statsQueryKey, "overview"],
    queryFn: () => getOverview(),
    ...backgroundRefreshOptions,
  })
}

export function statsBreakdownQueryOptions(
  scope: ChatScope,
  range: StatsRange
) {
  return queryOptions({
    queryKey: [...statsQueryKey, "breakdown", scope, range],
    queryFn: () => getStatsBreakdown({ data: { scope, range } }),
    ...backgroundRefreshOptions,
  })
}

export function timeSeriesQueryOptions(
  metric: SeriesMetric,
  range: StatsRange
) {
  return queryOptions({
    queryKey: [...statsQueryKey, "time-series", metric, range],
    queryFn: () => getTimeSeries({ data: { metric, range } }),
    ...backgroundRefreshOptions,
  })
}

export function referralStatsQueryOptions() {
  return queryOptions({
    queryKey: [...statsQueryKey, "referrals"],
    queryFn: () => getReferralStats(),
    ...backgroundRefreshOptions,
  })
}

export function otherStatsQueryOptions() {
  return queryOptions({
    queryKey: [...statsQueryKey, "other"],
    queryFn: () => getOtherStats(),
    ...backgroundRefreshOptions,
  })
}

export function userStatsQueryOptions(userId: string) {
  return queryOptions({
    queryKey: [...statsQueryKey, "user", userId],
    queryFn: () => getUserStats({ data: { userId } }),
    staleTime: USER_STALE_TIME,
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
    placeholderData: keepPreviousData,
    staleTime: USER_STALE_TIME,
  })
}
