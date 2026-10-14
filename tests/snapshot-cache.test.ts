import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const metadata = vi.hoisted(() => vi.fn())
vi.mock("@/lib/stats/queries", () => ({ getSnapshotMetadataRaw: metadata }))

import {
  clearSnapshotCache,
  invalidateSnapshotMetadata,
  SNAPSHOT_METADATA_TTL_MS,
  SNAPSHOT_RESULT_TTL_MS,
  snapshotRead,
} from "@/lib/stats/snapshot-cache"
import { DatabaseTask, withDatabaseTask } from "@/lib/tasks/server"

const version = (refreshedAt: number) => [
  {
    dataset: "rolling_24h",
    refreshedAt,
    windowStartEpoch: 0,
    windowEndEpoch: 1,
  },
  { dataset: "daily", refreshedAt: 10, windowStartEpoch: 0, windowEndEpoch: 1 },
]

describe("snapshot read cache", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    clearSnapshotCache()
    metadata.mockReset()
    metadata.mockResolvedValue(version(100))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("shares one load per snapshot version and reloads when the version changes", async () => {
    const load = vi.fn(async () => ({ total: load.mock.calls.length }))
    const [first, second] = await Promise.all([
      snapshotRead("overview", load),
      snapshotRead("overview", load),
    ])
    expect(first).toBe(second)
    expect(await snapshotRead("overview", load)).toBe(first)
    expect(load).toHaveBeenCalledTimes(1)
    expect(metadata).toHaveBeenCalledTimes(1)

    metadata.mockResolvedValue(version(200))
    vi.advanceTimersByTime(SNAPSHOT_METADATA_TTL_MS + 1)
    expect(await snapshotRead("overview", load)).toEqual({ total: 2 })
    expect(load).toHaveBeenCalledTimes(2)
  })

  it("expires results that join live data even when the snapshot is unchanged", async () => {
    const load = vi.fn(async () => load.mock.calls.length)
    await snapshotRead("popular-videos:24h:1", load)
    vi.advanceTimersByTime(SNAPSHOT_RESULT_TTL_MS + 1)
    expect(await snapshotRead("popular-videos:24h:1", load)).toBe(2)
  })

  it("never caches failures and reads uncached when metadata is unavailable", async () => {
    const failing = vi.fn(async () => {
      throw new Error("relation does not exist")
    })
    await expect(snapshotRead("referrals", failing)).rejects.toThrow()
    await expect(snapshotRead("referrals", failing)).rejects.toThrow()
    expect(failing).toHaveBeenCalledTimes(2)

    clearSnapshotCache()
    metadata.mockRejectedValue(new Error("metadata missing"))
    const load = vi.fn(async () => "direct")
    expect(await snapshotRead("other", load)).toBe("direct")
    expect(await snapshotRead("other", load)).toBe("direct")
    expect(load).toHaveBeenCalledTimes(2)
  })

  it("lets one reader cancel without cancelling the shared load", async () => {
    let finish!: (value: string) => void
    const load = vi.fn(
      () => new Promise<string>((resolve) => (finish = resolve))
    )
    const task = new DatabaseTask()
    const cancelled = withDatabaseTask(task, () =>
      snapshotRead("breakdown:all:24h", load)
    )
    const other = snapshotRead("breakdown:all:24h", load)
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1))
    task.controller.abort()
    await expect(cancelled).rejects.toThrow()
    finish("shared")
    expect(await other).toBe("shared")
  })

  it("rechecks metadata after a manual rebuild completes", async () => {
    const load = vi.fn(async () => load.mock.calls.length)
    await snapshotRead("overview", load)
    metadata.mockResolvedValue(version(300))
    invalidateSnapshotMetadata()
    expect(await snapshotRead("overview", load)).toBe(2)
  })
})
