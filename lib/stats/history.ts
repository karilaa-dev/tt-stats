import "@/lib/server-only"
import { canonicalPostUrl } from "@/lib/media/post-links"
import type { Pool } from "pg"
import { DataAccessError, getPool } from "@/lib/db/pool"
import { withDatabaseStage } from "@/lib/db/diagnostics"
import { getHistoryComparisons } from "./history-comparisons"
import { savedHistoryMediaSql } from "@/lib/media/saved"
import { userHistorySql, historyMatches } from "./history-source"
import { parseVideoPlatform } from "./validation"
import type { HistoryFilters, PaginatedUserDownloads } from "./types"

function comparisons(source: string) {
  return `CROSS JOIN LATERAL (
    SELECT count(DISTINCT matched.user_id) FILTER (WHERE matched.user_id <> $1::bigint) AS other_chats,
      coalesce(bool_or(matched.downloaded_at IS NULL OR matched.downloaded_at < 946684800
        OR matched.downloaded_at > floor(extract(epoch FROM now()))::bigint), true) AS uncertain
    FROM (${historyMatches(source)}) matched
  ) comparison
  LEFT JOIN LATERAL (
    SELECT user_id FROM (${historyMatches(source)}) matched
    ORDER BY downloaded_at ASC NULLS LAST, pk_id ASC LIMIT 1
  ) first_download ON true`
}

const fields = `page.pk_id::text AS id, page.event_id, page.downloaded_at, page.shared_link, page.media_kind,
  page.cache_hit, page.video_details_id::text,
  coalesce(details.platform, CASE WHEN page.media_kind = 'audio' THEN 'tiktok' END) AS platform,
  coalesce(details.platform_video_id, page.audio_video_id) AS platform_video_id,
  details.creator_username, details.canonical_link,
  details.views_display, details.likes_display,
  ${savedHistoryMediaSql("page")} AS has_saved_media`
interface HistoryRow {
  id: string | null
  platform: string | null
  platform_video_id: string | null
  creator_username: string | null
  canonical_link: string | null
  views_display: string | null
  likes_display: string | null
  downloaded_at: string | null
  shared_link: string
  media_kind: "video" | "images" | "audio"
  cache_hit: boolean
  video_details_id: string | null
  has_saved_media: boolean
  other_chats: string
  first_user: string | null
  uncertain: boolean
  times_downloaded?: string
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
    !filters.platform || filters.platform === "all" ? null : filters.platform,
  ]
  // Music events store TikTok post IDs only. Downloads without video details
  // have no platform and appear only under All platforms.
  const predicate = `user_id = $1::bigint
    AND ($2::bigint IS NULL OR downloaded_at >= $2::bigint)
    AND ($3::bigint IS NULL OR downloaded_at < $3::bigint)
    AND ($4::text IS NULL OR media_kind = $4)
    AND ($5::text IS NULL OR CASE WHEN media_kind = 'audio' THEN $5::text = 'tiktok'
      ELSE EXISTS (SELECT 1 FROM public.video_details platform_details
        WHERE platform_details.pk_id = history.video_details_id
          AND platform_details.platform = $5::text) END)
    ${filters.savedMediaOnly ? `AND ${savedHistoryMediaSql("history")}` : ""}`
  const direction = filters.sort === "oldest" ? "ASC" : "DESC"
  const popular = filters.category === "popular" || filters.sort === "popular"
  const chronological = `page.downloaded_at ${direction} NULLS LAST, page.event_id ${direction}, page.media_kind ${direction}`
  let rows: HistoryRow[]
  let total: string
  let page: number
  try {
    if (filters.discovery === "all" && !popular) {
      // Ordinary browsing compares only the requested page.
      const count = await withDatabaseStage("history.count", () =>
        pool.query<{ count: string }>(
          `WITH history AS (${userHistorySql}) SELECT count(*)::text AS count FROM history WHERE ${predicate}`,
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
          `WITH history AS (${userHistorySql}), page AS (
          SELECT * FROM history WHERE ${predicate}
          ORDER BY downloaded_at ${direction} NULLS LAST, event_id ${direction}, media_kind ${direction} LIMIT $6 OFFSET $7
        ) SELECT ${fields}, comparison.other_chats::text, comparison.uncertain,
          first_download.user_id::text AS first_user
        FROM page LEFT JOIN public.video_details details ON details.pk_id = page.video_details_id ${comparisons("page")} ORDER BY ${chronological}`,
          [...values, pageSize, (page - 1) * pageSize]
        )
      )
      rows = result.rows
    } else {
      // Evaluate each distinct candidate post once, then filter/rank all matches
      // before pagination. Repeated downloads stay as separate history events
      // everywhere except Popular downloads.
      const discovery =
        filters.discovery === "all"
          ? "true"
          : filters.discovery === "others"
            ? "other_chats > 0"
            : "other_chats > 0 AND NOT uncertain AND first_user = $1::bigint"
      const order = popular
        ? `page.other_chats DESC, ${chronological}`
        : chronological
      // Popular downloads list each post once. Repeats collapse into the event
      // matching the chosen order; legacy links without an ID stay separate.
      const popularPosts = `SELECT DISTINCT ON (post) posts.*,
          count(*) OVER (PARTITION BY post) AS times_downloaded
        FROM (
          SELECT qualified.*, coalesce('audio:' || audio_video_id,
            'video:' || video_details_id::text, 'event:' || pk_id::text) AS post
          FROM qualified
        ) posts
        ORDER BY post, downloaded_at ${direction} NULLS LAST, event_id ${direction}, media_kind ${direction}`
      const listed = popular ? "grouped" : "qualified"
      const cached = await getHistoryComparisons(
        pool,
        userId,
        predicate,
        values
      )
      const comparisonCtes = cached
        ? `compared AS (
        SELECT * FROM jsonb_to_recordset($8::jsonb)
          AS c(content_id bigint, other_chats bigint, uncertain boolean, first_user bigint)
      ), first_downloads AS (SELECT content_id, first_user FROM compared)`
        : `matched AS MATERIALIZED (
          SELECT identities.content_id, matched.*
          FROM identities CROSS JOIN LATERAL (${historyMatches("identities")}) matched
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
          `WITH history AS (${userHistorySql}), candidates AS MATERIALIZED (
          SELECT *
          FROM history WHERE ${predicate}
        ), identities AS (
          SELECT min(pk_id) AS content_id, video_details_id, audio_video_id
          FROM candidates WHERE video_details_id IS NOT NULL OR audio_video_id IS NOT NULL GROUP BY 2, 3
        ), ${comparisonCtes}, annotated AS MATERIALIZED (
          SELECT candidates.*, coalesce(compared.other_chats, 0) AS other_chats,
            coalesce(compared.uncertain, true) AS uncertain, first_downloads.first_user
          FROM candidates LEFT JOIN identities
            ON coalesce('audio:' || candidates.audio_video_id, 'video:' || candidates.video_details_id::text)
              = coalesce('audio:' || identities.audio_video_id, 'video:' || identities.video_details_id::text)
          LEFT JOIN compared USING (content_id) LEFT JOIN first_downloads USING (content_id)
        ), qualified AS MATERIALIZED (
          SELECT * FROM annotated WHERE ${discovery}
        )${popular ? `, grouped AS MATERIALIZED (${popularPosts})` : ""},
        totals AS (SELECT count(*) AS total FROM ${listed})
        SELECT totals.total::text, selected.* FROM totals
        LEFT JOIN LATERAL (
          SELECT ${fields}, page.other_chats::text, page.uncertain, page.first_user::text
            ${popular ? ", page.times_downloaded::text" : ""}
          FROM ${listed} page LEFT JOIN public.video_details details ON details.pk_id = page.video_details_id ORDER BY ${order}
          LIMIT $6 OFFSET (least($7::bigint, greatest(1, ceil(totals.total::numeric / $6)::bigint)) - 1) * $6
        ) selected ON true
        ORDER BY ${popular ? "selected.other_chats::bigint DESC," : ""}
          selected.downloaded_at ${direction} NULLS LAST, selected.event_id ${direction}, selected.media_kind ${direction}`,
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
        id: row.media_kind === "audio" ? `audio:${-BigInt(row.id!)}` : row.id!,
        platform: parseVideoPlatform(row.platform),
        videoId: row.platform_video_id?.trim() || null,
        canonicalUrl: canonicalPostUrl({
          platform: row.platform,
          videoId: row.platform_video_id,
          creator: row.creator_username,
          canonicalLink: row.canonical_link,
          mediaKind: row.media_kind,
        }),
        viewsDisplay: row.views_display?.trim() || null,
        likesDisplay: row.likes_display?.trim() || null,
        downloadedAt:
          row.downloaded_at === null ? null : Number(row.downloaded_at),
        sharedLink: row.shared_link,
        mediaKind: row.media_kind,
        cacheHit: row.cache_hit,
        videoDetailsId:
          row.media_kind === "audio" ? null : row.video_details_id,
        hasSavedMedia: row.has_saved_media,
        otherUniqueChats: row.other_chats,
        isFirstDownloader: row.uncertain ? null : row.first_user === userId,
        ...(row.times_downloaded
          ? { timesDownloaded: row.times_downloaded }
          : {}),
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
