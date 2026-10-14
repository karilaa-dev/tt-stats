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
} from "@/lib/stats/functions"
import { isBackgroundRefresh } from "@/lib/tasks/background"
import { queryKeys } from "@/lib/stats/query-keys"
import type {
  ChatScope,
  SeriesMetric,
  StatsDataset,
  StatsRange,
} from "@/lib/stats/types"

export const statsQueryKey = ["stats"] as const
const AGGREGATE_STALE_TIME = 5 * 60 * 1000
const ROLLING_REFRESH_INTERVAL = 5 * 60 * 1000
const DAILY_REFRESH_INTERVAL = 24 * 60 * 60 * 1000
const OPERATIONS_REFRESH_INTERVAL = 60 * 1000

const rollingRefreshOptions = {
  placeholderData: keepPreviousData,
  refetchInterval: databaseRefreshInterval(ROLLING_REFRESH_INTERVAL),
  staleTime: AGGREGATE_STALE_TIME,
} as const

const dailyRefreshOptions = {
  placeholderData: keepPreviousData,
  refetchInterval: databaseRefreshInterval(DAILY_REFRESH_INTERVAL),
  staleTime: DAILY_REFRESH_INTERVAL,
} as const

export function overviewQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.overview(),
    queryFn: ({ signal }) => getOverview(signal),
    ...rollingRefreshOptions,
  })
}

export function statsBreakdownQueryOptions(
  scope: ChatScope,
  range: StatsRange
) {
  return queryOptions({
    queryKey: queryKeys.breakdown(scope, range),
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
    queryKey: queryKeys.timeSeries(metric, range),
    queryFn: ({ signal }) => getTimeSeries({ signal, data: { metric, range } }),
    ...(range === "24h" ? rollingRefreshOptions : dailyRefreshOptions),
  })
}

export function referralStatsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.referrals(),
    queryFn: ({ signal }) => getReferralStats(signal),
    ...dailyRefreshOptions,
  })
}

export function otherStatsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.otherStats(),
    queryFn: ({ signal }) => getOtherStats(signal),
    ...dailyRefreshOptions,
  })
}

export function snapshotMetadataQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.snapshotMetadata(),
    queryFn: ({ signal }) => getSnapshotMetadata(signal),
    ...rollingRefreshOptions,
  })
}

export function statsJobsQueryOptions() {
  return queryOptions({
    queryKey: [...statsQueryKey, "jobs"],
    queryFn: (context) =>
      getStatsJobs(context.signal, isBackgroundRefresh(context)),
    placeholderData: keepPreviousData,
    refetchInterval: databaseRefreshInterval(OPERATIONS_REFRESH_INTERVAL),
    staleTime: 30_000,
  })
}

export function databaseSetupQueryOptions() {
  return queryOptions({
    queryKey: [...statsQueryKey, "database-setup"],
    queryFn: (context) =>
      getDatabaseSetupStatus(context.signal, isBackgroundRefresh(context)),
    placeholderData: keepPreviousData,
    refetchInterval: databaseRefreshInterval(OPERATIONS_REFRESH_INTERVAL),
    staleTime: 30_000,
  })
}

export function statsJobRunsQueryOptions(dataset: StatsDataset) {
  return queryOptions({
    queryKey: [...statsQueryKey, "jobs", dataset, "runs"],
    queryFn: (context) =>
      getStatsJobRuns({
        signal: context.signal,
        data: { dataset, limit: 10 },
        background: isBackgroundRefresh(context),
      }),
    placeholderData: keepPreviousData,
    refetchInterval: databaseRefreshInterval(OPERATIONS_REFRESH_INTERVAL),
    staleTime: 30_000,
  })
}
