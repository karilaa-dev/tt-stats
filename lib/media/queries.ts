import "@/lib/server-only"
import type { Pool, QueryResultRow } from "pg"
import { DataAccessError, getPool } from "@/lib/db/pool"
import type { Downloaders, PopularVideos } from "./types"

async function read<T extends QueryResultRow>(
  pool: Pool,
  sql: string,
  values: unknown[]
) {
  try {
    return (await pool.query<T>(sql, values)).rows
  } catch (error) {
    throw new DataAccessError(error)
  }
}

export interface StoredMedia {
  telegram_bot_id: string | null
  telegram_files:
    | { position: number; media_type: "photo" | "video"; file_id: string }[]
    | null
}

export async function getStoredMedia(
  downloadId: string,
  pool = getPool()
): Promise<StoredMedia | null> {
  const rows = await read<StoredMedia>(
    pool,
    `SELECT d.telegram_bot_id::text, d.telegram_files
     FROM public.videos v
     LEFT JOIN public.video_details d ON d.pk_id = v.video_details_id
     WHERE v.pk_id = $1::bigint`,
    [downloadId]
  )
  return rows[0] ?? null
}

export async function getDownloadersRaw(
  downloadId: string,
  page: number,
  pool = getPool()
): Promise<Downloaders> {
  // Only a cache-hit history entry can open this lookup. Match the stable
  // content identity, never shared URLs or Telegram file IDs that can rotate.
  const rows = await read<{
    user_id: string
    downloads: string
    last_downloaded_at: string | null
  }>(
    pool,
    `SELECT v.user_id::text, count(*)::text AS downloads,
            max(v.downloaded_at)::text AS last_downloaded_at
     FROM public.videos source
     JOIN public.videos v ON v.video_details_id = source.video_details_id
     WHERE source.pk_id = $1::bigint AND source.cache_hit
       AND v.user_id <> source.user_id
     GROUP BY v.user_id
     ORDER BY count(*) DESC, v.user_id
     LIMIT 21 OFFSET $2`,
    [downloadId, (page - 1) * 20]
  )
  return {
    items: rows
      .slice(0, 20)
      .map((row) => ({
        userId: row.user_id,
        downloads: row.downloads,
        lastDownloadedAt:
          row.last_downloaded_at === null
            ? null
            : Number(row.last_downloaded_at),
      })),
    page,
    hasMore: rows.length > 20,
  }
}

export async function getPopularVideosRaw(
  page: number,
  pool = getPool()
): Promise<PopularVideos> {
  // Unlinked legacy events can only be grouped by their exact stored URL.
  const rows = await read<{
    download_id: string
    shared_link: string
    downloads: string
    unique_chats: string
  }>(
    pool,
    `SELECT min(pk_id)::text AS download_id, min(shared_link) AS shared_link,
            count(*)::text AS downloads, count(DISTINCT user_id)::text AS unique_chats
     FROM public.videos
     WHERE media_kind = 'video'
     GROUP BY video_details_id, CASE WHEN video_details_id IS NULL THEN shared_link END
     ORDER BY count(*) DESC, min(pk_id)
     LIMIT 21 OFFSET $1`,
    [(page - 1) * 20]
  )
  return {
    items: rows
      .slice(0, 20)
      .map((row) => ({
        downloadId: row.download_id,
        sharedLink: row.shared_link,
        downloads: row.downloads,
        uniqueChats: row.unique_chats,
      })),
    page,
    hasMore: rows.length > 20,
  }
}
