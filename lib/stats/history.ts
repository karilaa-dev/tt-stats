import "@/lib/server-only"
import type { Pool } from "pg"
import { DataAccessError, getPool } from "@/lib/db/pool"
import { withDatabaseStage } from "@/lib/db/diagnostics"
import { getHistoryComparisons } from "./history-comparisons"
import { savedMediaSql } from "@/lib/media/saved"
import type { HistoryFilters, PaginatedUserDownloads } from "./types"

// Only stable video identities can establish other downloaders or who was first.
// Comparisons deliberately include events outside the selected history dates.
function matches(source: string) {
  return `SELECT user_id, downloaded_at, pk_id FROM public.videos
    WHERE ${source}.video_details_id IS NOT NULL
      AND video_details_id = ${source}.video_details_id AND user_id <> 0`
}

function comparisons(source: string) {
  return `CROSS JOIN LATERAL (
    SELECT count(DISTINCT matched.user_id) FILTER (WHERE matched.user_id <> $1::bigint) AS other_chats,
      coalesce(bool_or(matched.downloaded_at IS NULL OR matched.downloaded_at < 946684800
        OR matched.downloaded_at > floor(extract(epoch FROM now()))::bigint), true) AS uncertain
    FROM (${matches(source)}) matched
  ) comparison
  LEFT JOIN LATERAL (
    SELECT user_id FROM (${matches(source)}) matched
    ORDER BY downloaded_at ASC NULLS LAST, pk_id ASC LIMIT 1
  ) first_download ON true`
}

const fields = `page.pk_id::text AS id, page.downloaded_at, page.shared_link, page.media_kind,
  page.cache_hit, page.video_details_id::text,
  ${savedMediaSql("page.video_details_id")} AS has_saved_media`
interface HistoryRow {
  id: string | null
  downloaded_at: string | null
  shared_link: string
  media_kind: "video" | "images"
  cache_hit: boolean
  video_details_id: string | null
  has_saved_media: boolean
  other_chats: string
  first_user: string | null
  uncertain: boolean
  total?: string
}

export async function getUserDownloadsRaw(
  userId: string,
  requestedPage: number,
  pageSize: number,
  pool: Pool = getPool(),
  filters: HistoryFilters = {
    mediaKind: "all",
    discovery: "all",
    sort: "newest",
  }
): Promise<PaginatedUserDownloads> {
  const values = [
    userId,
    filters.from ?? null,
    filters.until ?? null,
    filters.mediaKind === "all" ? null : filters.mediaKind,
  ]
  const predicate = `user_id = $1::bigint
    AND ($2::bigint IS NULL OR downloaded_at >= $2::bigint)
    AND ($3::bigint IS NULL OR downloaded_at < $3::bigint)
    AND ($4::text IS NULL OR media_kind = $4)
    ${filters.savedMediaOnly ? `AND ${savedMediaSql("videos.video_details_id")}` : ""}`
  const newest = "page.downloaded_at DESC NULLS LAST, page.pk_id DESC"
  let rows: HistoryRow[]
  let total: string
  let page: number
  try {
    if (filters.discovery === "all" && filters.sort === "newest") {
      // Ordinary browsing compares only the requested page.
      const count = await withDatabaseStage("history.count", () =>
        pool.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM public.videos WHERE ${predicate}`,
          values
        )
      )
      total = count.rows[0]?.count ?? "0"
      page = Math.min(
        requestedPage,
        Math.max(1, Math.ceil(Number(total) / pageSize))
      )
      const result = await withDatabaseStage("history.page", () =>
        pool.query<HistoryRow>(
          `WITH page AS (
          SELECT * FROM public.videos WHERE ${predicate}
          ORDER BY downloaded_at DESC NULLS LAST, pk_id DESC LIMIT $5 OFFSET $6
        ) SELECT ${fields}, comparison.other_chats::text, comparison.uncertain,
          first_download.user_id::text AS first_user
        FROM page ${comparisons("page")} ORDER BY ${newest}`,
          [...values, pageSize, (page - 1) * pageSize]
        )
      )
      rows = result.rows
    } else {
      // Evaluate each distinct candidate post once, then filter/rank all matches
      // before pagination. Repeated downloads stay as separate history events.
      const discovery =
        filters.discovery === "all"
          ? "true"
          : filters.discovery === "others"
            ? "other_chats > 0"
            : "other_chats > 0 AND NOT uncertain AND first_user = $1::bigint"
      const order =
        filters.sort === "popular" ? `page.other_chats DESC, ${newest}` : newest
      const cached = await getHistoryComparisons(
        pool,
        userId,
        predicate,
        values
      )
      const comparisonCtes = cached
        ? `compared AS (
        SELECT * FROM jsonb_to_recordset($7::jsonb)
          AS c(content_id bigint, other_chats bigint, uncertain boolean, first_user bigint)
      ), first_downloads AS (SELECT content_id, first_user FROM compared)`
        : `matched AS MATERIALIZED (
          SELECT identities.content_id, v.user_id, v.downloaded_at, v.pk_id
          FROM identities JOIN public.videos v ON identities.video_details_id IS NOT NULL
            AND v.video_details_id = identities.video_details_id AND v.user_id <> 0
        ), compared AS (
          SELECT content_id,
            count(DISTINCT user_id) FILTER (WHERE user_id <> $1::bigint) AS other_chats,
            bool_or(downloaded_at IS NULL OR downloaded_at < 946684800
              OR downloaded_at > floor(extract(epoch FROM now()))::bigint) AS uncertain
          FROM matched GROUP BY content_id
        ), first_downloads AS (
          SELECT DISTINCT ON (content_id) content_id, user_id AS first_user FROM matched
          ORDER BY content_id, downloaded_at ASC NULLS LAST, pk_id ASC
        )`
      const result = await withDatabaseStage("history.rank", () =>
        pool.query<HistoryRow>(
          `WITH candidates AS MATERIALIZED (
          SELECT *
          FROM public.videos WHERE ${predicate}
        ), identities AS (
          SELECT min(pk_id) AS content_id, video_details_id
          FROM candidates WHERE video_details_id IS NOT NULL GROUP BY 2
        ), ${comparisonCtes}, annotated AS MATERIALIZED (
          SELECT candidates.*, coalesce(compared.other_chats, 0) AS other_chats,
            coalesce(compared.uncertain, true) AS uncertain, first_downloads.first_user
          FROM candidates LEFT JOIN identities USING (video_details_id)
          LEFT JOIN compared USING (content_id) LEFT JOIN first_downloads USING (content_id)
        ), qualified AS MATERIALIZED (
          SELECT * FROM annotated WHERE ${discovery}
        ), totals AS (SELECT count(*) AS total FROM qualified)
        SELECT totals.total::text, selected.* FROM totals
        LEFT JOIN LATERAL (
          SELECT ${fields}, page.other_chats::text, page.uncertain, page.first_user::text
          FROM qualified page ORDER BY ${order}
          LIMIT $5 OFFSET (least($6::bigint, greatest(1, ceil(totals.total::numeric / $5)::bigint)) - 1) * $5
        ) selected ON true
        ORDER BY ${filters.sort === "popular" ? "selected.other_chats::bigint DESC," : ""}
          selected.downloaded_at DESC NULLS LAST, selected.id::bigint DESC`,
          [
            ...values,
            pageSize,
            requestedPage,
            ...(cached ? [JSON.stringify(cached)] : []),
          ]
        )
      )
      total = result.rows[0]?.total ?? "0"
      page = Math.min(
        requestedPage,
        Math.max(1, Math.ceil(Number(total) / pageSize))
      )
      rows = result.rows.filter((row) => row.id !== null)
    }
    return {
      items: rows.map((row) => ({
        id: row.id!,
        downloadedAt:
          row.downloaded_at === null ? null : Number(row.downloaded_at),
        sharedLink: row.shared_link,
        mediaKind: row.media_kind,
        cacheHit: row.cache_hit,
        videoDetailsId: row.video_details_id,
        hasSavedMedia: row.has_saved_media,
        otherUniqueChats: row.other_chats,
        isFirstDownloader: row.uncertain ? null : row.first_user === userId,
      })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(Number(total) / pageSize),
    }
  } catch (error) {
    throw new DataAccessError(error)
  }
}
