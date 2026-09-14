import "@/lib/server-only"
import type { Pool } from "pg"
import type { Principal } from "@/lib/auth/types"
import { getPool, DataAccessError } from "@/lib/db/pool"
import {
  isFakeDataEnabled,
  getFakeUserDownloads,
  getFakePopularVideos,
} from "@/lib/dev/fake-data"
import { POPULAR_RANKING_VERSION } from "./types"

export async function canReadMedia(
  principal: Principal,
  downloadId: string,
  pool?: Pool
) {
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
    if (principal.user) {
      const owned = await database.query<{ allowed: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM public.videos WHERE pk_id = $1::bigint AND user_id = $2::bigint) AS allowed`,
        [downloadId, principal.user.id]
      )
      if (owned.rows[0]?.allowed === true) return true
    }
    const result = await database.query<{ allowed: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM tt_stats_cache.popular_videos ranking
         JOIN tt_stats_cache.popular_videos_metadata metadata USING (range)
         WHERE ranking.download_id = $1::bigint AND metadata.ranking_version = $2) AS allowed`,
      [downloadId, POPULAR_RANKING_VERSION]
    )
    return result.rows[0]?.allowed === true
  } catch (error) {
    throw new DataAccessError(error)
  }
}
