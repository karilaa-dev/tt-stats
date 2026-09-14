import "@/lib/server-only"
import type { Pool } from "pg"
import { reportDatabaseProgress } from "@/lib/tasks/server"

interface Identity {
  content_id: string
  video_details_id: string | null
  shared_link: string | null
  media_kind: string | null
}
interface Comparison {
  other_chats: string
  uncertain: boolean
  first_user: string | null
}

// Bound both entry count and approximate retained bytes. Cache only completed
// comparisons, never credentials or entire histories. Restarts clear the cache.
export class ComparisonCache {
  private entries = new Map<
    string,
    { value: Comparison; expires: number; bytes: number }
  >()
  private bytes = 0
  constructor(
    private now = Date.now,
    private maxEntries = 50_000,
    private maxBytes = 16 * 1024 * 1024
  ) {}
  get(key: string) {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    this.entries.delete(key)
    this.bytes -= entry.bytes
    if (entry.expires <= this.now()) return undefined
    this.entries.set(key, entry)
    this.bytes += entry.bytes
    return entry.value
  }
  set(key: string, value: Comparison) {
    const bytes = key.length * 2 + 256
    const previous = this.entries.get(key)
    if (previous) {
      this.entries.delete(key)
      this.bytes -= previous.bytes
    }
    if (bytes > this.maxBytes) return
    while (
      this.entries.size >= this.maxEntries ||
      this.bytes + bytes > this.maxBytes
    ) {
      const oldest = this.entries.entries().next().value
      if (!oldest) break
      this.entries.delete(oldest[0])
      this.bytes -= oldest[1].bytes
    }
    this.entries.set(key, { value, bytes, expires: this.now() + 120_000 })
    this.bytes += bytes
  }
}
const caches = new WeakMap<Pool, ComparisonCache>()

export async function getHistoryComparisons(
  pool: Pool,
  userId: string,
  predicate: string,
  values: unknown[]
) {
  reportDatabaseProgress("Finding videos in your history")
  const identities = await pool.query<Identity>(
    `SELECT min(pk_id)::text AS content_id, video_details_id::text,
      CASE WHEN video_details_id IS NULL THEN shared_link END AS shared_link,
      CASE WHEN video_details_id IS NULL THEN media_kind END AS media_kind
    FROM public.videos WHERE ${predicate}
    GROUP BY 2, 3, 4 LIMIT 20001`,
    values
  )
  // Large accounts retain the bounded, database-only ranking path rather than
  // retaining arbitrarily large identity lists in the application.
  if (identities.rows.length > 20_000) {
    reportDatabaseProgress("Ranking a large download history")
    return undefined
  }
  let cache = caches.get(pool)
  if (!cache) {
    cache = new ComparisonCache()
    caches.set(pool, cache)
  }
  const key = (row: Identity) =>
    `${userId}:${
      row.video_details_id !== null
        ? `id:${row.video_details_id}`
        : `link:${row.media_kind}:${row.shared_link}`
    }`
  const results: (Comparison & { content_id: string })[] = []
  const missing: Identity[] = []
  for (const row of identities.rows) {
    const cached = cache.get(key(row))
    if (cached) results.push({ ...cached, content_id: row.content_id })
    else missing.push(row)
  }
  reportDatabaseProgress("Comparing downloads", 0, missing.length)
  let comparedBatches = 0
  let comparisonTime = 0
  for (let offset = 0; offset < missing.length;) {
    // Establish visible progress quickly, then amortize full-table scan costs
    // over larger batches when optional identity indexes are absent.
    const batch = missing.slice(offset, offset + (offset === 0 ? 64 : 1024))
    const started = performance.now()
    // Keep these joins set-based. A forced per-identity LATERAL scan is
    // quadratic for legacy links on the standard bot schema without our indexes.
    const result = await pool.query<Comparison & { content_id: string }>(
      `WITH identities AS (
        SELECT * FROM jsonb_to_recordset($1::jsonb) AS i(content_id bigint, video_details_id bigint, shared_link text, media_kind text)
      ), matched AS MATERIALIZED (
        SELECT i.content_id, v.user_id, v.downloaded_at, v.pk_id FROM identities i
        JOIN public.videos v ON i.video_details_id IS NOT NULL
          AND v.video_details_id = i.video_details_id AND v.user_id <> 0
        UNION ALL
        SELECT i.content_id, v.user_id, v.downloaded_at, v.pk_id FROM identities i
        JOIN public.videos v ON i.video_details_id IS NULL
          AND v.video_details_id IS NULL AND v.user_id <> 0
          AND md5(v.shared_link) = md5(i.shared_link)
          AND v.shared_link = i.shared_link AND v.media_kind = i.media_kind
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
      [JSON.stringify(batch), userId]
    )
    const byId = new Map(result.rows.map((row) => [row.content_id, row]))
    for (const row of batch) {
      const comparison = byId.get(row.content_id)!
      cache.set(key(row), {
        other_chats: comparison.other_chats,
        uncertain: comparison.uncertain,
        first_user: comparison.first_user,
      })
      results.push(comparison)
    }
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
