import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import {
  getDatabaseSetupStatus,
  getOtherStats,
  getOverview,
  getReferralStats,
  getSnapshotMetadata,
  getStatsJobRuns,
  getStatsJobs,
  getStatsBreakdown,
  getTimeSeries,
  getUserDownloads,
  getUserStats,
} from "@/lib/stats/functions"
import type {
  ChatScope,
  SeriesMetric,
  StatsDataset,
  StatsRange,
} from "@/lib/stats/types"

export const statsQueryKey = ["stats"] as const
const AGGREGATE_STALE_TIME = 30 * 1000
const ROLLING_REFRESH_INTERVAL = 60 * 1000
const DAILY_REFRESH_INTERVAL = 15 * 60 * 1000
const USER_STALE_TIME = 60 * 1000

const rollingRefreshOptions = {
  placeholderData: keepPreviousData,
  refetchInterval: ROLLING_REFRESH_INTERVAL,
  staleTime: AGGREGATE_STALE_TIME,
} as const

const dailyRefreshOptions = {
  placeholderData: keepPreviousData,
  refetchInterval: DAILY_REFRESH_INTERVAL,
  staleTime: 5 * 60 * 1000,
} as const

export function overviewQueryOptions() {
  return queryOptions({
    queryKey: [...statsQueryKey, "overview"],
    queryFn: () => getOverview(),
    ...rollingRefreshOptions,
  })
}

export function statsBreakdownQueryOptions(
  scope: ChatScope,
  range: StatsRange
) {
  return queryOptions({
    queryKey: [...statsQueryKey, "breakdown", scope, range],
    queryFn: () => getStatsBreakdown({ data: { scope, range } }),
    ...(range === "24h" ? rollingRefreshOptions : dailyRefreshOptions),
  })
}

export function timeSeriesQueryOptions(
  metric: SeriesMetric,
  range: StatsRange
) {
  return queryOptions({
    queryKey: [...statsQueryKey, "time-series", metric, range],
    queryFn: () => getTimeSeries({ data: { metric, range } }),
    ...(range === "24h" ? rollingRefreshOptions : dailyRefreshOptions),
  })
}

export function referralStatsQueryOptions() {
  return queryOptions({
    queryKey: [...statsQueryKey, "referrals"],
    queryFn: () => getReferralStats(),
    ...dailyRefreshOptions,
  })
}

export function otherStatsQueryOptions() {
  return queryOptions({
    queryKey: [...statsQueryKey, "other"],
    queryFn: () => getOtherStats(),
    ...dailyRefreshOptions,
  })
}

export function snapshotMetadataQueryOptions() {
  return queryOptions({
    queryKey: [...statsQueryKey, "metadata"],
    queryFn: () => getSnapshotMetadata(),
    ...rollingRefreshOptions,
  })
}

export function statsJobsQueryOptions() {
  return queryOptions({
    queryKey: [...statsQueryKey, "jobs"],
    queryFn: () => getStatsJobs(),
    placeholderData: keepPreviousData,
    refetchInterval: ROLLING_REFRESH_INTERVAL,
    staleTime: AGGREGATE_STALE_TIME,
  })
}

export function databaseSetupQueryOptions() {
  return queryOptions({
    queryKey: [...statsQueryKey, "database-setup"],
    queryFn: () => getDatabaseSetupStatus(),
    placeholderData: keepPreviousData,
    refetchInterval: ROLLING_REFRESH_INTERVAL,
    staleTime: AGGREGATE_STALE_TIME,
  })
}

export function statsJobRunsQueryOptions(dataset: StatsDataset) {
  return queryOptions({
    queryKey: [...statsQueryKey, "jobs", dataset, "runs"],
    queryFn: () => getStatsJobRuns({ data: { dataset, limit: 10 } }),
    placeholderData: keepPreviousData,
    refetchInterval: ROLLING_REFRESH_INTERVAL,
    staleTime: AGGREGATE_STALE_TIME,
  })
}

export function userStatsQueryOptions(userId: string) {
  return queryOptions({
    queryKey: [...statsQueryKey, "user", userId],
    queryFn: () => getUserStats({ data: { userId } }),
    refetchInterval: USER_STALE_TIME,
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
    refetchInterval: USER_STALE_TIME,
    staleTime: USER_STALE_TIME,
  })
}
