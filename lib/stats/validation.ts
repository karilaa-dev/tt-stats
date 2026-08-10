import { z } from "zod"

import {
  CHAT_SCOPES,
  SERIES_METRICS,
  STATS_RANGES,
  type ChatScope,
  type SeriesMetric,
  type StatsRange,
} from "@/lib/stats/types"

const chatScopeSchema = z.enum(CHAT_SCOPES)
const statsRangeSchema = z.enum(STATS_RANGES)
const seriesMetricSchema = z.enum(SERIES_METRICS)
const telegramIdSchema = z
  .string()
  .regex(/^-?\d+$/u)
  .refine((value) => {
    try {
      BigInt(value)
      return true
    } catch {
      return false
    }
  })

export function parseChatScope(value: unknown): ChatScope {
  return chatScopeSchema.catch("all").parse(value)
}

export function parseStatsRange(value: unknown): StatsRange {
  return statsRangeSchema.catch("24h").parse(value)
}

export function parseSeriesMetric(value: unknown): SeriesMetric {
  return seriesMetricSchema.catch("users").parse(value)
}

export function parseTelegramId(value: unknown): string | null {
  const parsed = telegramIdSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}
