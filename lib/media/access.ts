import "@/lib/server-only"
import type { Pool } from "pg"
import type { Principal } from "@/lib/auth/types"
import { getPool, DataAccessError } from "@/lib/db/pool"
import {
  isFakeDataEnabled,
  getFakeUserDownloads,
  getFakePopularVideos,
} from "@/lib/dev/fake-data"
import { parseMediaId } from "./ids"
import { POPULAR_RANKING_VERSION } from "./types"

/** Accepts a videos.pk_id, or "audio:" and a music.pk_id. */
export async function canReadMedia(
  principal: Principal,
  downloadId: string,
  pool?: Pool
) {
  const media = parseMediaId(downloadId)
  if (!media) return false
  if (principal.admin) return true
  if (isFakeDataEnabled()) {
    const publicItems = getFakePopularVideos(1, "all", 1000).items
    return (
      publicItems.some((item) => item.downloadId === downloadId) ||
      Boolean(
        principal.user &&
        getFakeUserDownloads(principal.user.id, 1, 50).items.some(
          (item) => item.id === downloadId
        )
      )
    )
  }
  try {
    const database = pool ?? getPool()
    // Audio is personal history only; rankings never publish music events.
    if (media.kind === "audio") {
      if (!principal.user) return false
      const owned = await database.query<{ allowed: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM public.music WHERE pk_id = $1::bigint AND user_id = $2::bigint) AS allowed`,
        [media.id, principal.user.id]
      )
      return owned.rows[0]?.allowed === true
    }
    if (principal.user) {
      const owned = await database.query<{ allowed: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM public.videos WHERE pk_id = $1::bigint AND user_id = $2::bigint) AS allowed`,
        [media.id, principal.user.id]
      )
      if (owned.rows[0]?.allowed === true) return true
    }
    const result = await database.query<{ allowed: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM tt_stats_cache.popular_videos ranking
         JOIN tt_stats_cache.popular_videos_metadata metadata USING (range)
         WHERE ranking.download_id = $1::bigint AND metadata.ranking_version = $2) AS allowed`,
      [media.id, POPULAR_RANKING_VERSION]
    )
    return result.rows[0]?.allowed === true
  } catch (error) {
    throw new DataAccessError(error)
  }
}
