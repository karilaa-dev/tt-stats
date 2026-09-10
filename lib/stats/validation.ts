import {
  CHAT_SCOPES,
  SERIES_METRICS,
  STATS_RANGES,
  type ChatScope,
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

export function parseSeriesMetric(value: unknown): SeriesMetric {
  return parseOption(value, SERIES_METRICS, "users")
}

export function parseTelegramId(value: unknown): string | null {
  if (typeof value !== "string" || !/^-?\d+$/u.test(value)) return null
  try {
    BigInt(value)
    return value
  } catch {
    return null
  }
}
