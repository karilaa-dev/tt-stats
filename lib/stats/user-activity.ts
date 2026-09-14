import "@/lib/server-only"
import type { Pool } from "pg"
import { DataAccessError, getPool } from "@/lib/db/pool"
import type { UserActivity, UserActivityRange } from "./types"

export async function getUserActivityRaw(
  userId: string,
  range: UserActivityRange,
  pool: Pool = getPool()
): Promise<UserActivity> {
  const interval = range === "31d" ? "day" : range === "90d" ? "week" : "month"
  // Filter this account using videos_user_downloaded_idx before grouping. Use
  // daily points for 31 days, weekly for 90 days, and monthly for longer ranges.
  // Invalid timestamps before 2000 and future events do not extend the series.
  try {
    const result = await pool.query<{ bucket: string; count: string }>(
      `WITH bounds AS (
        SELECT now() AT TIME ZONE 'UTC' AS stop,
          CASE $2::text
            WHEN '31d' THEN date_trunc('day', now() AT TIME ZONE 'UTC') - interval '30 days'
            WHEN '90d' THEN date_trunc('day', now() AT TIME ZONE 'UTC') - interval '89 days'
            WHEN '1y' THEN date_trunc('month', now() AT TIME ZONE 'UTC') - interval '11 months'
            ELSE date_trunc('month', coalesce(
              to_timestamp((SELECT min(downloaded_at) FROM public.videos
                WHERE user_id = $1::bigint AND downloaded_at >= 946684800
                  AND downloaded_at <= floor(extract(epoch FROM now()))::bigint)) AT TIME ZONE 'UTC',
              now() AT TIME ZONE 'UTC')) END AS start
      ), counts AS (
        SELECT date_trunc($3::text, to_timestamp(v.downloaded_at) AT TIME ZONE 'UTC') AS bucket,
          count(*) AS count
        FROM public.videos v CROSS JOIN bounds b
        WHERE v.user_id = $1::bigint
          AND v.downloaded_at >= extract(epoch FROM b.start AT TIME ZONE 'UTC')::bigint
          AND v.downloaded_at <= floor(extract(epoch FROM b.stop AT TIME ZONE 'UTC'))::bigint
        GROUP BY 1
      ), buckets AS (
        SELECT generate_series(date_trunc($3::text, start), date_trunc($3::text, stop),
          ('1 ' || $3::text)::interval) AS bucket FROM bounds
      )
      SELECT extract(epoch FROM buckets.bucket AT TIME ZONE 'UTC')::text AS bucket,
        coalesce(counts.count, 0)::text AS count
      FROM buckets LEFT JOIN counts USING (bucket) ORDER BY buckets.bucket`,
      [userId, range, interval]
    )
    return {
      interval,
      points: result.rows.map((row) => ({
        bucketEpoch: Number(row.bucket),
        count: Number(row.count),
      })),
    }
  } catch (error) {
    throw new DataAccessError(error)
  }
}
