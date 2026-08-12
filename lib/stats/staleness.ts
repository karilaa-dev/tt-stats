import type { SnapshotMetadata } from "@/lib/stats/types"

export const SNAPSHOT_STALE_AFTER_SECONDS = {
  rolling_24h: 15 * 60,
  daily: 36 * 60 * 60,
} as const

export function isSnapshotStale(
  snapshot: SnapshotMetadata,
  nowEpoch = Date.now() / 1000
): boolean {
  return (
    nowEpoch - snapshot.refreshedAt >
    SNAPSHOT_STALE_AFTER_SECONDS[snapshot.dataset]
  )
}
