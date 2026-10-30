import "@/lib/server-only"
import {
  getFakeOtherStats,
  getFakeOverview,
  getFakePopularVideos,
  getFakeReferralStats,
  getFakeSnapshotMetadata,
  getFakeStatsBreakdown,
  getFakeTimeSeries,
  isFakeDataEnabled,
} from "@/lib/dev/fake-data"
import { getPopularVideosRaw } from "@/lib/media/queries"
import { getTelegramMauRaw } from "@/lib/telegram/mau"
import type { TelegramMau } from "@/lib/telegram/types"
import {
  getOtherStatsRaw,
  getOverviewRaw,
  getReferralStatsRaw,
  getStatsBreakdownRaw,
  getPlatformStatsBreakdownRaw,
  getTimeSeriesRaw,
} from "./queries"
import { getSnapshotMetadataCached, snapshotRead } from "./snapshot-cache"
import type {
  ChatScope,
  DownloadPlatform,
  SeriesMetric,
  StatsRange,
} from "./types"

// Public statistics shared by Astro actions and server-rendered pages. Every
// visitor sees the same snapshot, so reads are cached per snapshot version.
const fake = isFakeDataEnabled

export const loadSnapshotMetadata = async () =>
  fake() ? getFakeSnapshotMetadata() : getSnapshotMetadataCached()

export const loadOverview = async () =>
  fake() ? getFakeOverview() : snapshotRead("overview", () => getOverviewRaw())

export const loadStatsBreakdown = async (
  scope: ChatScope,
  range: StatsRange,
  platform: DownloadPlatform = "all"
) =>
  fake()
    ? getFakeStatsBreakdown(scope, range, platform)
    : snapshotRead(`breakdown:${scope}:${range}:${platform}`, () =>
        platform === "all"
          ? getStatsBreakdownRaw(scope, range)
          : getPlatformStatsBreakdownRaw(scope, range, platform)
      )

export const loadTimeSeries = async (
  metric: SeriesMetric,
  range: StatsRange
) =>
  fake()
    ? getFakeTimeSeries(metric, range)
    : snapshotRead(`time-series:${metric}:${range}`, () =>
        getTimeSeriesRaw(metric, range)
      )

export const loadReferralStats = async () =>
  fake()
    ? getFakeReferralStats()
    : snapshotRead("referrals", () => getReferralStatsRaw())

/** Includes admin-only leaders; callers remove them for other visitors. */
export const loadOtherStats = async () =>
  fake() ? getFakeOtherStats() : snapshotRead("other", () => getOtherStatsRaw())

export const loadPopularVideos = async (page: number, range: StatsRange) =>
  fake()
    ? getFakePopularVideos(page, range)
    : snapshotRead(`popular-videos:v4:${range}:${page}`, () =>
        getPopularVideosRaw(page, undefined, range)
      )

export const loadTelegramMau = async (): Promise<TelegramMau> =>
  fake()
    ? { status: "available", count: 28430, checkedAt: Date.now(), demo: true }
    : getTelegramMauRaw()
