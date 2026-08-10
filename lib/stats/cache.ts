import "server-only"

import { cacheLife, cacheTag } from "next/cache"

import {
  getOtherStatsRaw,
  getOverviewRaw,
  getReferralStatsRaw,
  getStatsBreakdownRaw,
  getTimeSeriesRaw,
} from "@/lib/stats/queries"
import type { ChatScope, SeriesMetric, StatsRange } from "@/lib/stats/types"

export const STATS_CACHE_TAG = "stats"

function configureStatsCache(): void {
  cacheLife("stats")
  cacheTag(STATS_CACHE_TAG)
}

export async function getCachedOverview() {
  "use cache"
  configureStatsCache()
  return getOverviewRaw()
}

export async function getCachedStatsBreakdown(
  scope: ChatScope,
  range: StatsRange
) {
  "use cache"
  configureStatsCache()
  return getStatsBreakdownRaw(scope, range)
}

export async function getCachedTimeSeries(
  metric: SeriesMetric,
  range: StatsRange
) {
  "use cache"
  configureStatsCache()
  return getTimeSeriesRaw(metric, range)
}

export async function getCachedReferralStats() {
  "use cache"
  configureStatsCache()
  return getReferralStatsRaw()
}

export async function getCachedOtherStats() {
  "use cache"
  configureStatsCache()
  return getOtherStatsRaw()
}
