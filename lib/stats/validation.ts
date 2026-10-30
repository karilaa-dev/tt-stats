import {
  CHAT_SCOPES,
  DOWNLOAD_PLATFORMS,
  SERIES_METRICS,
  STATS_RANGES,
  type ChatScope,
  type DownloadPlatform,
  type SeriesMetric,
  type StatsRange,
} from "@/lib/stats/types"

// These parsers also run in the browser. Keep URL validation independent of
// the schema library used by server actions.
function parseOption<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T
): T {
  return options.find((option) => option === value) ?? fallback
}

export function parseChatScope(value: unknown): ChatScope {
  return parseOption(value, CHAT_SCOPES, "all")
}

export function parseStatsRange(value: unknown): StatsRange {
  return parseOption(value, STATS_RANGES, "24h")
}

export function parseDownloadPlatform(value: unknown): DownloadPlatform {
  return parseOption(value, DOWNLOAD_PLATFORMS, "all")
}

/** A stored video_details.platform; anything unrecognised has no platform. */
export function parseVideoPlatform(
  value: unknown
): Exclude<DownloadPlatform, "all"> | null {
  return value === "tiktok" || value === "instagram" ? value : null
}

export function parseSeriesMetric(value: unknown): SeriesMetric {
  return parseOption(value, SERIES_METRICS, "users")
}

export function parseTelegramId(value: unknown): string | null {
  if (typeof value !== "string" || !/^-?\d{1,19}$/u.test(value)) return null
  try {
    const id = BigInt(value)
    if (id === 0n || id < -9223372036854775808n || id > 9223372036854775807n)
      return null
    return id.toString()
  } catch {
    return null
  }
}
