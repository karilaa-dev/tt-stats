import "@tanstack/react-start/server-only"

import type { Pool, QueryResult, QueryResultRow } from "pg"

import { DataAccessError, getPool } from "@/lib/db/pool"
import type {
  ChatScope,
  OtherStats,
  OverviewStats,
  PaginatedUserDownloads,
  RankedValue,
  SeriesMetric,
  SnapshotMetadata,
  StatsBreakdown,
  StatsDataset,
  StatsJob,
  StatsJobRun,
  StatsRange,
  TimeSeriesPoint,
  ManualRefreshRequest,
  UserStats,
} from "@/lib/stats/types"

interface CountRow {
  count: string
}

interface BreakdownRow {
  scope: ChatScope
  range: StatsRange
  chats: string
  downloads: string
  download_users: string
  images: string
  image_users: string
  music: string
  music_users: string
  generated_at?: string
  metadata_count?: string
}

interface MetadataRow {
  dataset: StatsDataset
  refreshed_at: Date | string
  window_start_epoch: string
  window_end_epoch: string
}

const MAX_ALL_TIME_CHART_POINTS = 720

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

function missingSnapshot(): never {
  throw new DataAccessError(undefined, "snapshotsMissing")
}

function toEpoch(value: Date | string | null): number | null {
  if (value === null) return null
  return Math.floor(new Date(value).getTime() / 1000)
}

function mapMetadata(row: MetadataRow): SnapshotMetadata {
  return {
    dataset: row.dataset,
    refreshedAt: toEpoch(row.refreshed_at) ?? 0,
    windowStartEpoch: Number(row.window_start_epoch),
    windowEndEpoch: Number(row.window_end_epoch),
  }
}

function mapBreakdown(row: BreakdownRow): StatsBreakdown {
  return {
    chats: row.chats,
    downloads: {
      total: row.downloads,
      uniqueUsers: row.download_users,
      images: row.images,
      uniqueImageUsers: row.image_users,
    },
    music: { total: row.music, uniqueUsers: row.music_users },
  }
}

export async function getSnapshotMetadataRaw(
  pool: Pool = getPool()
): Promise<SnapshotMetadata[]> {
  const result = await safeQuery<MetadataRow>(
    pool,
    `SELECT dataset, refreshed_at, window_start_epoch::text, window_end_epoch::text
     FROM tt_stats_cache.refresh_metadata
     ORDER BY dataset DESC`
  )
  return result.rows.map(mapMetadata)
}

export async function getStatsBreakdownRaw(
  scope: ChatScope,
  range: StatsRange,
  pool: Pool = getPool()
): Promise<StatsBreakdown> {
  const result = await safeQuery<BreakdownRow>(
    pool,
    `SELECT scope, range, chats::text, downloads::text,
            download_users::text, images::text, image_users::text,
            music::text, music_users::text
     FROM tt_stats_cache.breakdown
     WHERE scope = $1 AND range = $2`,
    [scope, range]
  )
  const row = result.rows[0]
  return row ? mapBreakdown(row) : missingSnapshot()
}

export async function getOverviewRaw(
  pool: Pool = getPool()
): Promise<OverviewStats> {
  const breakdowns = await safeQuery<BreakdownRow>(
    pool,
    `WITH metadata AS (
       SELECT count(*)::text AS metadata_count,
              floor(extract(epoch FROM max(refreshed_at)))::bigint::text AS generated_at
       FROM tt_stats_cache.refresh_metadata
     )
     SELECT breakdown.scope, breakdown.range, breakdown.chats::text,
            breakdown.downloads::text, breakdown.download_users::text,
            breakdown.images::text, breakdown.image_users::text,
            breakdown.music::text, breakdown.music_users::text,
            metadata.generated_at, metadata.metadata_count
     FROM tt_stats_cache.breakdown breakdown
     CROSS JOIN metadata
     WHERE breakdown.scope IN ('users', 'groups')
       AND breakdown.range IN ('24h', 'all')`
  )

  if (breakdowns.rowCount !== 4 || breakdowns.rows[0]?.metadata_count !== "2") {
    missingSnapshot()
  }
  const find = (scope: "users" | "groups", range: "24h" | "all") => {
    const row = breakdowns.rows.find(
      (candidate) => candidate.scope === scope && candidate.range === range
    )
    return row ? mapBreakdown(row) : missingSnapshot()
  }

  return {
    users: { all: find("users", "all"), last24Hours: find("users", "24h") },
    groups: {
      all: find("groups", "all"),
      last24Hours: find("groups", "24h"),
    },
    generatedAt: Number(breakdowns.rows[0]?.generated_at ?? 0),
  }
}

export async function getTimeSeriesRaw(
  metric: SeriesMetric,
  range: StatsRange,
  pool: Pool = getPool()
): Promise<TimeSeriesPoint[]> {
  const dataset: StatsDataset = range === "24h" ? "rolling_24h" : "daily"
  const result = await safeQuery<{
    bucket_epoch: string | null
    count: string | null
    snapshot_exists: boolean
  }>(
    pool,
    `WITH metadata AS (
       SELECT EXISTS (
         SELECT 1 FROM tt_stats_cache.refresh_metadata WHERE dataset = $3
       ) AS snapshot_exists
     ), numbered AS (
       SELECT series.bucket_epoch, series.count,
              row_number() OVER (ORDER BY series.bucket_epoch) AS ordinal,
              count(*) OVER () AS point_count
       FROM tt_stats_cache.time_series series
       WHERE series.metric = $1 AND series.range = $2
     ), aggregated AS (
       SELECT min(bucket_epoch)::bigint AS bucket_epoch,
              sum(count)::bigint AS count
       FROM numbered
       GROUP BY CASE
         WHEN $2 = 'all' THEN
           (ordinal - 1) / greatest(1, (point_count + $4 - 1) / $4)
         ELSE ordinal - 1
       END
     )
     SELECT aggregated.bucket_epoch::text, aggregated.count::text,
            metadata.snapshot_exists
     FROM metadata
     LEFT JOIN aggregated ON true
     ORDER BY aggregated.bucket_epoch`,
    [metric, range, dataset, MAX_ALL_TIME_CHART_POINTS]
  )
  if (!result.rows[0]?.snapshot_exists) missingSnapshot()

  return result.rows.flatMap((row) => {
    if (row.bucket_epoch === null || row.count === null) return []
    const bucketEpoch = Number(row.bucket_epoch)
    const count = Number(row.count)
    if (!Number.isSafeInteger(bucketEpoch) || !Number.isSafeInteger(count)) {
      throw new DataAccessError(undefined, "snapshotData")
    }
    return [{ bucketEpoch, count }]
  })
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
    `SELECT u.user_id::text, u.registered_at, u.lang, u.link, u.file_mode,
            COUNT(v.pk_id)::text AS downloads,
            COUNT(v.pk_id) FILTER (WHERE v.media_kind = 'images')::text AS images
     FROM public.users u
     LEFT JOIN public.videos v ON v.user_id = u.user_id
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

export async function getUserDownloadsRaw(
  userId: string,
  requestedPage: number,
  pageSize: number,
  pool: Pool = getPool()
): Promise<PaginatedUserDownloads> {
  const countResult = await safeQuery<CountRow>(
    pool,
    "SELECT COUNT(*)::text AS count FROM public.videos WHERE user_id = $1::bigint",
    [userId]
  )
  const total = countResult.rows[0]?.count ?? "0"
  const totalPages = Math.ceil(Number(total) / pageSize)
  const page = totalPages ? Math.min(requestedPage, totalPages) : 1
  const result = await safeQuery<{
    id: string
    downloaded_at: string | number | null
    shared_link: string
    media_kind: "video" | "images"
  }>(
    pool,
    `SELECT pk_id::text AS id, downloaded_at, shared_link, media_kind
     FROM public.videos
     WHERE user_id = $1::bigint
     ORDER BY downloaded_at DESC NULLS LAST, pk_id DESC
     LIMIT $2 OFFSET $3`,
    [userId, pageSize, (page - 1) * pageSize]
  )
  return {
    items: result.rows.map((row) => ({
      id: row.id,
      downloadedAt:
        row.downloaded_at === null ? null : Number(row.downloaded_at),
      sharedLink: row.shared_link,
      mediaKind: row.media_kind,
    })),
    page,
    pageSize,
    total,
    totalPages,
  }
}

export async function getReferralStatsRaw(
  pool: Pool = getPool()
): Promise<RankedValue[]> {
  const result = await safeQuery<{
    value: string | null
    count: string | null
    snapshot_exists: boolean
  }>(
    pool,
    `WITH metadata AS (
       SELECT EXISTS (
         SELECT 1 FROM tt_stats_cache.refresh_metadata WHERE dataset = 'daily'
       ) AS snapshot_exists
     )
     SELECT ranking.value, ranking.count::text, metadata.snapshot_exists
     FROM metadata
     LEFT JOIN tt_stats_cache.rankings ranking
       ON ranking.category = 'referrals'
     ORDER BY ranking.position`
  )
  if (!result.rows[0]?.snapshot_exists) missingSnapshot()
  return result.rows.flatMap((row) =>
    row.value === null || row.count === null
      ? []
      : [{ value: row.value, count: row.count }]
  )
}

export async function getOtherStatsRaw(
  pool: Pool = getPool()
): Promise<OtherStats> {
  const result = await safeQuery<{
    file_mode_users: string | null
    languages: RankedValue[]
    top_downloaders: RankedValue[]
    snapshot_exists: boolean
  }>(
    pool,
    `WITH metadata AS (
       SELECT EXISTS (
         SELECT 1 FROM tt_stats_cache.refresh_metadata WHERE dataset = 'daily'
       ) AS snapshot_exists
     )
     SELECT scalar.value::text AS file_mode_users,
            coalesce(
              jsonb_agg(jsonb_build_object('value', ranking.value, 'count', ranking.count::text)
                ORDER BY ranking.position) FILTER (WHERE ranking.category = 'languages'),
              '[]'::jsonb
            ) AS languages,
            coalesce(
              jsonb_agg(jsonb_build_object('value', ranking.value, 'count', ranking.count::text)
                ORDER BY ranking.position) FILTER (WHERE ranking.category = 'top_downloaders'),
              '[]'::jsonb
            ) AS top_downloaders,
            metadata.snapshot_exists
     FROM metadata
     LEFT JOIN tt_stats_cache.scalars scalar ON scalar.name = 'file_mode_users'
     LEFT JOIN tt_stats_cache.rankings ranking
       ON ranking.category IN ('languages', 'top_downloaders')
     GROUP BY scalar.value, metadata.snapshot_exists`
  )
  const row = result.rows[0]
  if (!row?.snapshot_exists || row.file_mode_users === null) missingSnapshot()
  return {
    fileModeUsers: row.file_mode_users,
    languages: row.languages,
    topDownloaders: row.top_downloaders,
  }
}

export async function getStatsJobsRaw(
  pool: Pool = getPool()
): Promise<StatsJob[]> {
  const result = await safeQuery<{
    dataset: StatsDataset
    job_name: string
    schedule: string | null
    active: boolean
    last_status: string | null
    last_started_at: Date | string | null
    last_finished_at: Date | string | null
    last_duration_ms: string | null
    refreshed_at: Date | string | null
    window_start_epoch: string | null
    window_end_epoch: string | null
    manual_request_id: string | null
    manual_status: ManualRefreshRequest["status"] | null
    manual_requested_at: Date | string | null
    manual_started_at: Date | string | null
    manual_finished_at: Date | string | null
  }>(pool, "SELECT * FROM tt_stats_cache.list_stats_jobs()")

  return result.rows.map((row) => ({
    dataset: row.dataset,
    jobName: row.job_name,
    schedule: row.schedule ?? "",
    active: row.active,
    lastStatus: row.last_status,
    lastStartedAt: toEpoch(row.last_started_at),
    lastFinishedAt: toEpoch(row.last_finished_at),
    lastDurationMs:
      row.last_duration_ms === null ? null : Number(row.last_duration_ms),
    snapshot:
      row.refreshed_at === null ||
      row.window_start_epoch === null ||
      row.window_end_epoch === null
        ? null
        : {
            dataset: row.dataset,
            refreshedAt: toEpoch(row.refreshed_at) ?? 0,
            windowStartEpoch: Number(row.window_start_epoch),
            windowEndEpoch: Number(row.window_end_epoch),
          },
    pendingRequest:
      row.manual_request_id === null ||
      row.manual_status === null ||
      row.manual_requested_at === null
        ? null
        : {
            id: row.manual_request_id,
            dataset: row.dataset,
            status: row.manual_status,
            requestedAt: toEpoch(row.manual_requested_at) ?? 0,
            startedAt: toEpoch(row.manual_started_at),
            finishedAt: toEpoch(row.manual_finished_at),
          },
  }))
}

export async function getStatsJobRunsRaw(
  dataset: StatsDataset,
  limit: number,
  pool: Pool = getPool()
): Promise<StatsJobRun[]> {
  const result = await safeQuery<{
    run_id: string
    status: string
    started_at: Date | string | null
    finished_at: Date | string | null
    duration_ms: string | null
  }>(pool, "SELECT * FROM tt_stats_cache.list_stats_job_runs($1, $2)", [
    dataset,
    limit,
  ])
  return result.rows.map((row) => ({
    id: row.run_id,
    status: row.status,
    startedAt: toEpoch(row.started_at),
    finishedAt: toEpoch(row.finished_at),
    durationMs: row.duration_ms === null ? null : Number(row.duration_ms),
  }))
}

export async function updateStatsJobScheduleRaw(
  dataset: StatsDataset,
  schedule: string,
  pool: Pool = getPool()
): Promise<void> {
  await safeQuery(
    pool,
    "SELECT tt_stats_cache.update_stats_job_schedule($1, $2)",
    [dataset, schedule]
  )
}

export async function setStatsJobActiveRaw(
  dataset: StatsDataset,
  active: boolean,
  pool: Pool = getPool()
): Promise<void> {
  await safeQuery(pool, "SELECT tt_stats_cache.set_stats_job_active($1, $2)", [
    dataset,
    active,
  ])
}

export async function requestStatsJobRunRaw(
  dataset: StatsDataset,
  pool: Pool = getPool()
): Promise<string> {
  const result = await safeQuery<{ id: string }>(
    pool,
    "SELECT tt_stats_cache.request_stats_job_run($1)::text AS id",
    [dataset]
  )
  return result.rows[0]?.id ?? missingSnapshot()
}

export async function getManualRefreshRequestRaw(
  id: string,
  pool: Pool = getPool()
): Promise<ManualRefreshRequest | null> {
  const result = await safeQuery<{
    id: string
    dataset: StatsDataset
    status: ManualRefreshRequest["status"]
    requested_at: Date | string
    started_at: Date | string | null
    finished_at: Date | string | null
  }>(
    pool,
    "SELECT * FROM tt_stats_cache.get_manual_refresh_request($1::bigint)",
    [id]
  )
  const row = result.rows[0]
  return row
    ? {
        id: row.id,
        dataset: row.dataset,
        status: row.status,
        requestedAt: toEpoch(row.requested_at) ?? 0,
        startedAt: toEpoch(row.started_at),
        finishedAt: toEpoch(row.finished_at),
      }
    : null
}

export async function getBotstatUserIdsRaw(
  pool: Pool = getPool()
): Promise<string[]> {
  const result = await safeQuery<{ user_id: string }>(
    pool,
    "SELECT user_id::text FROM public.users ORDER BY users.user_id ASC"
  )
  return result.rows.map((row) => row.user_id)
}
