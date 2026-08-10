import type { StatsRange, TimeSeriesPoint } from "@/lib/stats/types"

export const RANGE_SECONDS: Record<Exclude<StatsRange, "all">, number> = {
  "24h": 24 * 60 * 60,
  "7d": 7 * 24 * 60 * 60,
  "31d": 31 * 24 * 60 * 60,
}

export function bucketSecondsForRange(range: StatsRange): number {
  return range === "24h" || range === "7d" ? 60 * 60 : 24 * 60 * 60
}

export function cutoffForRange(
  range: Exclude<StatsRange, "all">,
  nowEpoch: number
): number {
  return nowEpoch - RANGE_SECONDS[range]
}

export function fillTimeSeries(
  rows: Array<{ bucket: string; count: string }>,
  startEpoch: number,
  endEpoch: number,
  bucketSeconds: number
): TimeSeriesPoint[] {
  const counts = new Map<number, number>()
  for (const row of rows) {
    const bucket = Number(row.bucket)
    const count = Number(row.count)
    if (Number.isFinite(bucket) && Number.isSafeInteger(count)) {
      counts.set(bucket, count)
    }
  }

  const firstBucket = Math.floor(startEpoch / bucketSeconds) * bucketSeconds
  const lastBucket = Math.floor(endEpoch / bucketSeconds) * bucketSeconds
  const points: TimeSeriesPoint[] = []
  for (
    let bucketEpoch = firstBucket;
    bucketEpoch <= lastBucket;
    bucketEpoch += bucketSeconds
  ) {
    points.push({ bucketEpoch, count: counts.get(bucketEpoch) ?? 0 })
  }
  return points
}
