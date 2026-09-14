import { afterEach, describe, expect, it, vi } from "vitest"
import {
  DatabaseTask,
  TaskRegistry,
  withDatabaseTask,
  reportDatabaseProgress,
} from "@/lib/tasks/server"
import { ComparisonCache } from "@/lib/stats/history-comparisons"

afterEach(() => vi.useRealTimers())
describe("database task control", () => {
  it("uses batch timing for ETA when the first batch is smaller", () => {
    vi.useFakeTimers()
    const task = new DatabaseTask()
    task.report("Comparing downloads", 64, 2271, 3000)
    expect(task.status().remainingMs).toBe(3000)
    vi.advanceTimersByTime(1000)
    expect(task.status().remainingMs).toBe(2000)
    // An overdue estimate returns to unknown instead of claiming completion.
    vi.advanceTimersByTime(2001)
    expect(task.status().remainingMs).toBeNull()
    task.report("Preparing your results")
    expect(task.status().remainingMs).toBeNull()
  })
  it("isolates status and cancellation by owner and consumes an early cancel", () => {
    const registry = new TaskRegistry()
    const task = registry.start("one", "owner")!
    expect(registry.get("one", "other")).toBeUndefined()
    expect(registry.cancel("one", "other")).toBe(false)
    expect(task.controller.signal.aborted).toBe(false)
    expect(registry.cancel("one", "owner")).toBe(true)
    expect(task.controller.signal.aborted).toBe(true)
    registry.cancel("early", "owner")
    expect(() => registry.start("early", "owner")).toThrow("Request cancelled")
  })
  it("bounds active tasks and cancellation tombstones, and expires work", () => {
    let now = 0
    const registry = new TaskRegistry(20, () => now)
    for (let index = 0; index < 8; index++)
      expect(registry.start(String(index), "owner")).not.toBeNull()
    expect(registry.start("excess", "owner")).toBeNull()
    expect(registry.cancel("tombstone", "owner")).toBe(false)
    const task = registry.get("0", "owner")!
    now = 120_001
    expect(registry.get("0", "owner")).toBeUndefined()
    expect(task.controller.signal.aborted).toBe(true)
    expect(registry.start("new", "owner")).not.toBeNull()
  })
  it("reports measured batches and estimates time from completed work only", async () => {
    vi.useFakeTimers()
    const task = new DatabaseTask()
    expect(task.status().remainingMs).toBeNull()
    await withDatabaseTask(task, async () => {
      reportDatabaseProgress("Comparing downloads", 0, 100)
      await vi.advanceTimersByTimeAsync(1000)
      reportDatabaseProgress("Comparing downloads", 25, 100)
    })
    expect(task.status()).toMatchObject({
      completed: 25,
      total: 100,
      remainingMs: 3000,
      elapsedMs: 1000,
    })
    task.controller.abort()
    expect(() =>
      withDatabaseTask(task, () => reportDatabaseProgress("Next query"))
    ).toThrow()
  })
})

describe("history comparison cache", () => {
  const value = { other_chats: "10", first_user: "1", uncertain: false }
  it("expires counts even when repeatedly read", () => {
    let now = 0
    const cache = new ComparisonCache(() => now)
    cache.set("1:id:10", value)
    now = 119_999
    expect(cache.get("1:id:10")).toEqual(value)
    expect(cache.get("2:id:10")).toBeUndefined()
    now = 120_000
    expect(cache.get("1:id:10")).toBeUndefined()
  })
  it("evicts least recently used entries and refuses oversized keys", () => {
    const cache = new ComparisonCache(Date.now, 2, 1000)
    cache.set("a", value)
    cache.set("b", value)
    cache.get("a")
    cache.set("c", value)
    expect(cache.get("b")).toBeUndefined()
    expect(cache.get("a")).toEqual(value)
    cache.set("x".repeat(1000), value)
    expect(cache.get("x".repeat(1000))).toBeUndefined()
    expect(cache.get("a")).toEqual(value)
  })
})
