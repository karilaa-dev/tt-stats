import type { QueryClient } from "@tanstack/react-query"
import type { StatsDataset } from "./types"
/** Metadata versions, rather than a daily timer, determine when daily views change. */
export function snapshotViewMatches(
  key: readonly unknown[],
  dataset: StatsDataset
) {
  if (key[0] !== "stats") return false
  const section = key[1]
  if (section === "overview") return true
  if (section === "referrals" || section === "other") return dataset === "daily"
  if (
    section === "breakdown" ||
    section === "time-series" ||
    section === "popular-videos"
  ) {
    const range = key[section === "popular-videos" ? 2 : 3]
    return (range === "24h") === (dataset === "rolling_24h")
  }
  return false
}
export function invalidateSnapshotViews(
  client: QueryClient,
  dataset: StatsDataset
) {
  return client.invalidateQueries({
    predicate: (query) => snapshotViewMatches(query.queryKey, dataset),
  })
}
