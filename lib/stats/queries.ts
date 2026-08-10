import "server-only"

import type { Pool, QueryResult, QueryResultRow } from "pg"

import { DataAccessError, getPool } from "@/lib/db/pool"
import {
  bucketSecondsForRange,
  cutoffForRange,
  fillTimeSeries,
} from "@/lib/stats/time-series"
import type {
  ChatScope,
  OtherStats,
  OverviewStats,
  RankedValue,
  SeriesMetric,
  StatsBreakdown,
  StatsRange,
  TimeSeriesPoint,
  UserStats,
} from "@/lib/stats/types"

const scopeCondition: Record<ChatScope, string> = {
  users: "user_id > 0",
  groups: "user_id < 0",
  all: "user_id <> 0",
}

interface CountRow {
  count: string
}

interface MetricRow {
  total: string
  unique_users: string
  images?: string
  unique_image_users?: string
}

async function safeQuery<Row extends QueryResultRow>(
  pool: Pool,
  text: string,
  values: unknown[] = []
): Promise<QueryResult<Row>> {
  try {
    return await pool.query<Row>(text, values)
  } catch (error) {
    if (error instanceof DataAccessError) throw error
    throw new DataAccessError(error)
  }
}

function period(
  range: StatsRange,
  nowEpoch: number
): { clause: string; values: unknown[] } {
  if (range === "all") return { clause: "", values: [] }
  return {
    clause: "AND __TIME_COLUMN__ >= $1 AND __TIME_COLUMN__ <= $2",
    values: [cutoffForRange(range, nowEpoch), nowEpoch],
  }
}

export async function getStatsBreakdownRaw(
  scope: ChatScope,
  range: StatsRange,
  nowEpoch = Math.floor(Date.now() / 1000),
  pool: Pool = getPool()
): Promise<StatsBreakdown> {
  const filter = scopeCondition[scope]
  const rangePeriod = period(range, nowEpoch)
  const userPeriod = rangePeriod.clause.replaceAll(
    "__TIME_COLUMN__",
    "registered_at"
  )
  const videoPeriod = rangePeriod.clause.replaceAll(
    "__TIME_COLUMN__",
    "downloaded_at"
  )
  const musicPeriod = videoPeriod

  const [chatsResult, downloadsResult, musicResult] = await Promise.all([
    safeQuery<CountRow>(
      pool,
      `SELECT COUNT(user_id)::text AS count
       FROM users
       WHERE ${filter} ${userPeriod}`,
      rangePeriod.values
    ),
    safeQuery<MetricRow>(
      pool,
      `SELECT
         COUNT(*)::text AS total,
         COUNT(DISTINCT user_id)::text AS unique_users,
         COUNT(*) FILTER (WHERE media_kind = 'images')::text AS images,
         COUNT(DISTINCT user_id) FILTER (WHERE media_kind = 'images')::text AS unique_image_users
       FROM videos
       WHERE ${filter} ${videoPeriod}`,
      rangePeriod.values
    ),
    safeQuery<MetricRow>(
      pool,
      `SELECT
         COUNT(*)::text AS total,
         COUNT(DISTINCT user_id)::text AS unique_users
       FROM music
       WHERE ${filter} ${musicPeriod}`,
      rangePeriod.values
    ),
  ])

  const downloads = downloadsResult.rows[0]
  const music = musicResult.rows[0]
  return {
    chats: chatsResult.rows[0]?.count ?? "0",
    downloads: {
      total: downloads?.total ?? "0",
      uniqueUsers: downloads?.unique_users ?? "0",
      images: downloads?.images ?? "0",
      uniqueImageUsers: downloads?.unique_image_users ?? "0",
    },
    music: {
      total: music?.total ?? "0",
      uniqueUsers: music?.unique_users ?? "0",
    },
  }
}

export async function getOverviewRaw(
  nowEpoch = Math.floor(Date.now() / 1000),
  pool: Pool = getPool()
): Promise<OverviewStats> {
  const [usersAll, usersDay, groupsAll, groupsDay] = await Promise.all([
    getStatsBreakdownRaw("users", "all", nowEpoch, pool),
    getStatsBreakdownRaw("users", "24h", nowEpoch, pool),
    getStatsBreakdownRaw("groups", "all", nowEpoch, pool),
    getStatsBreakdownRaw("groups", "24h", nowEpoch, pool),
  ])

  return {
    users: { all: usersAll, last24Hours: usersDay },
    groups: { all: groupsAll, last24Hours: groupsDay },
    generatedAt: nowEpoch,
  }
}

const seriesSource: Record<
  SeriesMetric,
  { table: string; timeColumn: string }
> = {
  users: { table: "users", timeColumn: "registered_at" },
  videos: { table: "videos", timeColumn: "downloaded_at" },
  music: { table: "music", timeColumn: "downloaded_at" },
}

export async function getTimeSeriesRaw(
  metric: SeriesMetric,
  range: StatsRange,
  nowEpoch = Math.floor(Date.now() / 1000),
  pool: Pool = getPool()
): Promise<TimeSeriesPoint[]> {
  const source = seriesSource[metric]
  const bucketSeconds = bucketSecondsForRange(range)
  let startEpoch: number

  if (range === "all") {
    const minimum = await safeQuery<{ minimum: string | null }>(
      pool,
      `SELECT MIN(${source.timeColumn})::text AS minimum
       FROM ${source.table}
       WHERE user_id <> 0
         AND ${source.timeColumn} IS NOT NULL
         AND ${source.timeColumn} <= $1`,
      [nowEpoch]
    )
    if (!minimum.rows[0]?.minimum) return []
    startEpoch = Number(minimum.rows[0].minimum)
  } else {
    startEpoch = cutoffForRange(range, nowEpoch)
  }

  const rows = await safeQuery<{ bucket: string; count: string }>(
    pool,
    `SELECT
       (FLOOR(${source.timeColumn}::numeric / $1) * $1)::bigint::text AS bucket,
       COUNT(*)::text AS count
     FROM ${source.table}
     WHERE user_id <> 0
       AND ${source.timeColumn} IS NOT NULL
       AND ${source.timeColumn} >= $2
       AND ${source.timeColumn} <= $3
     GROUP BY 1
     ORDER BY 1`,
    [bucketSeconds, startEpoch, nowEpoch]
  )

  return fillTimeSeries(rows.rows, startEpoch, nowEpoch, bucketSeconds)
}

export async function getUserStatsRaw(
  userId: string,
  pool: Pool = getPool()
): Promise<UserStats | null> {
  const result = await safeQuery<{
    user_id: string
    registered_at: string | number | null
    lang: string
    link: string | null
    file_mode: boolean
    downloads: string
    images: string
  }>(
    pool,
    `SELECT
       u.user_id::text,
       u.registered_at,
       u.lang,
       u.link,
       u.file_mode,
       COUNT(v.pk_id)::text AS downloads,
       COUNT(v.pk_id) FILTER (WHERE v.media_kind = 'images')::text AS images
     FROM users u
     LEFT JOIN videos v ON v.user_id = u.user_id
     WHERE u.user_id = $1::bigint
     GROUP BY u.user_id, u.registered_at, u.lang, u.link, u.file_mode`,
    [userId]
  )
  const row = result.rows[0]
  if (!row) return null

  return {
    userId: row.user_id,
    registeredAt: row.registered_at === null ? null : Number(row.registered_at),
    language: row.lang,
    referral: row.link,
    fileMode: row.file_mode,
    downloads: row.downloads,
    images: row.images,
  }
}

export async function getReferralStatsRaw(
  pool: Pool = getPool()
): Promise<RankedValue[]> {
  const result = await safeQuery<{ value: string; count: string }>(
    pool,
    `SELECT link AS value, COUNT(*)::text AS count
     FROM users
     WHERE link IS NOT NULL
     GROUP BY link
     ORDER BY COUNT(*) DESC, link ASC
     LIMIT 10`
  )
  return result.rows
}

export async function getOtherStatsRaw(
  pool: Pool = getPool()
): Promise<OtherStats> {
  const [fileMode, languages, topDownloaders] = await Promise.all([
    safeQuery<CountRow>(
      pool,
      "SELECT COUNT(user_id)::text AS count FROM users WHERE file_mode = TRUE"
    ),
    safeQuery<{ value: string; count: string }>(
      pool,
      `SELECT lang AS value, COUNT(*)::text AS count
       FROM users
       GROUP BY lang
       ORDER BY COUNT(*) DESC, lang ASC`
    ),
    safeQuery<{ value: string; count: string }>(
      pool,
      `SELECT user_id::text AS value, COUNT(*)::text AS count
       FROM videos
       GROUP BY user_id
       ORDER BY COUNT(*) DESC, user_id ASC
       LIMIT 10`
    ),
  ])

  return {
    fileModeUsers: fileMode.rows[0]?.count ?? "0",
    languages: languages.rows,
    topDownloaders: topDownloaders.rows,
  }
}

export async function getBotstatUserIdsRaw(
  pool: Pool = getPool()
): Promise<string[]> {
  const result = await safeQuery<{ user_id: string }>(
    pool,
    "SELECT user_id::text FROM users ORDER BY users.user_id ASC"
  )
  return result.rows.map((row) => row.user_id)
}
