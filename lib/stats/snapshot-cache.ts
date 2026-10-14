import "@/lib/server-only"
import { awaitForCurrentTask } from "@/lib/db/memory-cache"
import { withoutDatabaseTask } from "@/lib/tasks/server"
import { getSnapshotMetadataRaw } from "./queries"
import type { SnapshotMetadata } from "./types"

// Snapshot tables and refresh_metadata change in the same transaction, so a
// metadata version identifies every public read. The short metadata lifetime
// bounds how long a new snapshot can stay unseen; the result lifetime bounds
// live joins such as saved-media availability on ranking pages.
export const SNAPSHOT_METADATA_TTL_MS = 10_000
export const SNAPSHOT_RESULT_TTL_MS = 60_000
const MAX_RESULTS = 256

interface Shared<T> {
  promise: Promise<T>
  expires: number
  version?: string
}
const state = globalThis as typeof globalThis & {
  ttStatsSnapshotMetadata?: Shared<SnapshotMetadata[]>
  ttStatsSnapshotResults?: Map<string, Shared<unknown>>
}
const results = (state.ttStatsSnapshotResults ??= new Map())

/** Loads run outside the triggering request so its cancellation cannot fail other readers. */
function share<T>(load: () => Promise<T>, expires: number, version?: string) {
  const entry: Shared<T> = {
    promise: withoutDatabaseTask(load),
    expires,
    version,
  }
  return entry
}

export function getSnapshotMetadataCached(): Promise<SnapshotMetadata[]> {
  const now = Date.now()
  let entry = state.ttStatsSnapshotMetadata
  if (!entry || entry.expires <= now) {
    const created = share(
      () => getSnapshotMetadataRaw(),
      now + SNAPSHOT_METADATA_TTL_MS
    )
    state.ttStatsSnapshotMetadata = entry = created
    created.promise.catch(() => {
      if (state.ttStatsSnapshotMetadata === created)
        state.ttStatsSnapshotMetadata = undefined
    })
  }
  return awaitForCurrentTask(entry.promise)
}

export async function snapshotRead<T>(
  key: string,
  load: () => Promise<T>
): Promise<T> {
  let version: string
  try {
    version = (await getSnapshotMetadataCached())
      .map((snapshot) => `${snapshot.dataset}:${snapshot.refreshedAt}`)
      .join("|")
  } catch {
    // Without a version the read keeps its own error reporting, uncached.
    return load()
  }
  const now = Date.now()
  const cached = results.get(key) as Shared<T> | undefined
  if (cached && cached.version === version && cached.expires > now) {
    results.delete(key)
    results.set(key, cached)
    return awaitForCurrentTask(cached.promise)
  }
  const created = share(load, now + SNAPSHOT_RESULT_TTL_MS, version)
  results.delete(key)
  results.set(key, created)
  while (results.size > MAX_RESULTS)
    results.delete(results.keys().next().value!)
  created.promise.catch(() => {
    if (results.get(key) === created) results.delete(key)
  })
  return awaitForCurrentTask(created.promise)
}

/** A completed manual rebuild becomes visible on the next read. */
export function invalidateSnapshotMetadata() {
  state.ttStatsSnapshotMetadata = undefined
}

/** Tests and operational resets only. */
export function clearSnapshotCache() {
  state.ttStatsSnapshotMetadata = undefined
  results.clear()
}
