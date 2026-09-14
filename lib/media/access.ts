import "@/lib/server-only"
import type { Pool } from "pg"
import type { Principal } from "@/lib/auth/types"
import { getPool, DataAccessError } from "@/lib/db/pool"
import { isFakeDataEnabled, getFakeUserDownloads } from "@/lib/dev/fake-data"

export async function canReadMedia(
  principal: Principal,
  downloadId: string,
  pool?: Pool
) {
  if (principal.admin) return true
  if (isFakeDataEnabled()) {
    const publicItems = getFakeUserDownloads("123456789", 1, 50).items
    return (
      publicItems.some(
        (item) => item.id === downloadId && item.mediaKind === "video"
      ) ||
      Boolean(
        principal.user &&
        getFakeUserDownloads(principal.user.id, 1, 50).items.some(
          (item) => item.id === downloadId
        )
      )
    )
  }
  try {
    const result = await (pool ?? getPool()).query<{ allowed: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM public.videos WHERE pk_id = $1::bigint AND user_id = $2::bigint)
       OR EXISTS (SELECT 1 FROM tt_stats_cache.popular_videos ranking
         JOIN tt_stats_cache.popular_videos_metadata metadata USING (range)
         WHERE ranking.download_id = $1::bigint AND metadata.ranking_version = 2) AS allowed`,
      [downloadId, principal.user?.id ?? null]
    )
    return result.rows[0]?.allowed === true
  } catch (error) {
    throw new DataAccessError(error)
  }
}
