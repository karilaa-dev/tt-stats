import { databaseRefreshInterval } from "@/lib/http-client"
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
  refetchInterval: databaseRefreshInterval(ROLLING_REFRESH_INTERVAL),
  staleTime: AGGREGATE_STALE_TIME,
} as const

const dailyRefreshOptions = {
  placeholderData: keepPreviousData,
  refetchInterval: databaseRefreshInterval(DAILY_REFRESH_INTERVAL),
  staleTime: 5 * 60 * 1000,
} as const

export function overviewQueryOptions() {
  return queryOptions({
    queryKey: [...statsQueryKey, "overview"],
    queryFn: ({ signal }) => getOverview(signal),
    ...rollingRefreshOptions,
  })
}

export function statsBreakdownQueryOptions(
  scope: ChatScope,
  range: StatsRange
) {
  return queryOptions({
    queryKey: [...statsQueryKey, "breakdown", scope, range],
    queryFn: ({ signal }) =>
      getStatsBreakdown({ signal, data: { scope, range } }),
    ...(range === "24h" ? rollingRefreshOptions : dailyRefreshOptions),
  })
}

export function timeSeriesQueryOptions(
  metric: SeriesMetric,
  range: StatsRange
) {
  return queryOptions({
    queryKey: [...statsQueryKey, "time-series", metric, range],
    queryFn: ({ signal }) => getTimeSeries({ signal, data: { metric, range } }),
    ...(range === "24h" ? rollingRefreshOptions : dailyRefreshOptions),
  })
}

export function referralStatsQueryOptions() {
  return queryOptions({
    queryKey: [...statsQueryKey, "referrals"],
    queryFn: ({ signal }) => getReferralStats(signal),
    ...dailyRefreshOptions,
  })
}

export function otherStatsQueryOptions() {
  return queryOptions({
    queryKey: [...statsQueryKey, "other"],
    queryFn: ({ signal }) => getOtherStats(signal),
    ...dailyRefreshOptions,
  })
}

export function snapshotMetadataQueryOptions() {
  return queryOptions({
    queryKey: [...statsQueryKey, "metadata"],
    queryFn: ({ signal }) => getSnapshotMetadata(signal),
    ...rollingRefreshOptions,
  })
}

export function statsJobsQueryOptions() {
  return queryOptions({
    queryKey: [...statsQueryKey, "jobs"],
    queryFn: ({ signal }) => getStatsJobs(signal),
    placeholderData: keepPreviousData,
    refetchInterval: databaseRefreshInterval(ROLLING_REFRESH_INTERVAL),
    staleTime: AGGREGATE_STALE_TIME,
  })
}

export function databaseSetupQueryOptions() {
  return queryOptions({
    queryKey: [...statsQueryKey, "database-setup"],
    queryFn: ({ signal }) => getDatabaseSetupStatus(signal),
    placeholderData: keepPreviousData,
    refetchInterval: databaseRefreshInterval(ROLLING_REFRESH_INTERVAL),
    staleTime: AGGREGATE_STALE_TIME,
  })
}

export function statsJobRunsQueryOptions(dataset: StatsDataset) {
  return queryOptions({
    queryKey: [...statsQueryKey, "jobs", dataset, "runs"],
    queryFn: ({ signal }) =>
      getStatsJobRuns({ signal, data: { dataset, limit: 10 } }),
    placeholderData: keepPreviousData,
    refetchInterval: databaseRefreshInterval(ROLLING_REFRESH_INTERVAL),
    staleTime: AGGREGATE_STALE_TIME,
  })
}

export function userStatsQueryOptions(userId: string) {
  return queryOptions({
    queryKey: [...statsQueryKey, "user", userId],
    queryFn: ({ signal }) => getUserStats({ signal, data: { userId } }),
    refetchInterval: databaseRefreshInterval(USER_STALE_TIME),
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
    queryFn: ({ signal }) =>
      getUserDownloads({ signal, data: { userId, page, pageSize } }),
    placeholderData: keepPreviousData,
    refetchInterval: databaseRefreshInterval(USER_STALE_TIME),
    staleTime: USER_STALE_TIME,
  })
}
