import type {
  ChatScope,
  DownloadPlatform,
  SeriesMetric,
  StatsRange,
} from "./types"

// Browser queries and server-rendered initial data must use identical keys.
export const queryKeys = {
  session: () => ["session"] as const,
  snapshotMetadata: () => ["stats", "metadata"] as const,
  overview: () => ["stats", "overview"] as const,
  breakdown: (
    scope: ChatScope,
    range: StatsRange,
    platform: DownloadPlatform = "all"
  ) => ["stats", "breakdown", scope, range, platform] as const,
  timeSeries: (metric: SeriesMetric, range: StatsRange) =>
    ["stats", "time-series", metric, range] as const,
  referrals: () => ["stats", "referrals"] as const,
  otherStats: () => ["stats", "other"] as const,
  popularVideos: (
    range: StatsRange,
    page: number,
    platform: DownloadPlatform = "all"
  ) => ["stats", "popular-videos", range, platform, page] as const,
  telegramMau: () => ["telegram-mau"] as const,
  /** Personal statistics for the signed-in account, or an admin lookup. */
  userStats: (own: boolean, userId: string) =>
    ["stats", own ? "me" : "user", userId] as const,
}
