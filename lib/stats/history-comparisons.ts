import "@/lib/server-only"
import type { Pool } from "pg"
import { cacheKey, readCacheBatch, cachedBatch } from "@/lib/db/query-cache"
import { currentDatabaseTask, reportDatabaseProgress } from "@/lib/tasks/server"
import { logHistoryCache, withDatabaseStage } from "@/lib/db/diagnostics"

interface Identity {
  content_id: string
  video_details_id: string
}
interface Comparison {
  other_chats: string
  uncertain: boolean
  first_user: string | null
}

export async function getHistoryComparisons(
  pool: Pool,
  userId: string,
  predicate: string,
  values: unknown[]
) {
  reportDatabaseProgress("Finding videos in your history")
  const identities = await withDatabaseStage("history.identities", () =>
    pool.query<Identity>(
      `SELECT min(pk_id)::text AS content_id, video_details_id::text
    FROM public.videos WHERE (${predicate}) AND video_details_id IS NOT NULL
    GROUP BY 2 LIMIT 20001`,
      values
    )
  )
  // Large accounts retain the bounded, database-only ranking path rather than
  // retaining arbitrarily large identity lists in the application.
  if (identities.rows.length > 20_000) {
    reportDatabaseProgress("Ranking a large download history")
    return undefined
  }
  const key = (row: Identity) =>
    cacheKey("history-comparison", {
      userId,
      visibility: "account",
      videoDetailsId: row.video_details_id,
    })
  const cache = await readCacheBatch<Comparison>(identities.rows.map(key), pool)
  const results: (Comparison & { content_id: string })[] = []
  const missing: Identity[] = []
  for (const row of identities.rows) {
    const cached = cache.get(key(row))
    if (cached) results.push({ ...cached.value, content_id: row.content_id })
    else missing.push(row)
  }
  logHistoryCache(
    identities.rows.length,
    results.length,
    currentDatabaseTask()?.id
  )
  reportDatabaseProgress("Comparing downloads", 0, missing.length)
  let comparedBatches = 0
  let comparisonTime = 0
  for (let offset = 0; offset < missing.length;) {
    const batch = missing.slice(offset, offset + (offset === 0 ? 64 : 1024))
    const started = performance.now()
    const byKey = new Map(batch.map((row) => [key(row), row]))
    const comparisons = await cachedBatch<Comparison>(
      batch.map(key),
      async (claimed) => {
        const claimedBatch = claimed.map((key) => byKey.get(key)!)
        const result = await withDatabaseStage(
          "history.compare",
          () =>
            pool.query<Comparison & { content_id: string }>(
              `WITH identities AS (
        SELECT * FROM jsonb_to_recordset($1::jsonb) AS i(content_id bigint, video_details_id bigint)
      ), matched AS MATERIALIZED (
        SELECT i.content_id, v.user_id, v.downloaded_at, v.pk_id FROM identities i
        JOIN public.videos v ON i.video_details_id IS NOT NULL
          AND v.video_details_id = i.video_details_id AND v.user_id <> 0
      ), compared AS (
        SELECT content_id, count(DISTINCT user_id) FILTER (WHERE user_id <> $2::bigint) AS other_chats,
          bool_or(downloaded_at IS NULL OR downloaded_at < 946684800
            OR downloaded_at > floor(extract(epoch FROM now()))::bigint) AS uncertain
        FROM matched GROUP BY content_id
      ), first_downloads AS (
        SELECT DISTINCT ON (content_id) content_id, user_id AS first_user FROM matched
        ORDER BY content_id, downloaded_at ASC NULLS LAST, pk_id ASC
      ) SELECT i.content_id::text, coalesce(compared.other_chats, 0)::text AS other_chats,
        coalesce(compared.uncertain, true) AS uncertain, first_downloads.first_user::text
      FROM identities i LEFT JOIN compared USING(content_id) LEFT JOIN first_downloads USING(content_id)`,
              [JSON.stringify(claimedBatch), userId]
            ),
          {
            batch: comparedBatches + 1,
            batchSize: claimedBatch.length,
            completed: offset,
            total: missing.length,
          }
        )
        const byId = new Map(result.rows.map((row) => [row.content_id, row]))
        return new Map(
          claimedBatch.map((row) => {
            const comparison = byId.get(row.content_id)
            if (!comparison) throw new Error("Incomplete history comparison")
            return [
              key(row),
              {
                other_chats: comparison.other_chats,
                uncertain: comparison.uncertain,
                first_user: comparison.first_user,
              },
            ]
          })
        )
      },
      pool
    )
    for (const row of batch)
      results.push({
        ...comparisons.get(key(row))!,
        content_id: row.content_id,
      })
    offset += batch.length
    comparisonTime += performance.now() - started
    comparedBatches++
    reportDatabaseProgress(
      "Comparing downloads",
      offset,
      missing.length,
      (Math.ceil((missing.length - offset) / 1024) * comparisonTime) /
        comparedBatches
    )
  }
  reportDatabaseProgress("Preparing your results")
  return results
}
