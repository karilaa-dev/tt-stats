import { afterEach, describe, expect, it, vi } from "vitest"
import type { Pool } from "pg"
import { EventEmitter } from "node:events"
import { trackPool } from "@/lib/db/cancellation"
import { DataAccessError } from "@/lib/db/pool"
import { safeDatabaseError, withDatabaseStage } from "@/lib/db/diagnostics"
import { DatabaseTask, withDatabaseTask } from "@/lib/tasks/server"

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

function testPool() {
  const client = Object.assign(new EventEmitter(), {
    query: vi
      .fn()
      .mockResolvedValue({ rows: [{ secret: "private-result" }], rowCount: 1 }),
    release: vi.fn(),
  })
  const pool = {
    connect: vi.fn().mockResolvedValue(client),
    totalCount: 1,
    idleCount: 0,
    waitingCount: 2,
  }
  return { client, pool, tracked: trackPool(pool as unknown as Pool) }
}

describe("database diagnostics", () => {
  it("logs the failing history stage and safe error code without SQL, values or error details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    const { client, tracked } = testPool()
    const task = new DatabaseTask()
    const error = Object.assign(
      new Error("postgresql://secret:password@host/private"),
      {
        code: "57014",
        detail: "private download URL",
        query: "secret query",
      }
    )
    client.query.mockRejectedValue(error)
    await expect(
      withDatabaseTask(task, () =>
        withDatabaseStage(
          "history.compare",
          () => tracked.query("SELECT 'private SQL'", ["private parameter"]),
          { batch: 1, batchSize: 64, completed: 0, total: 2271 }
        )
      )
    ).rejects.toBe(error)
    expect(log).toHaveBeenCalledTimes(1)
    const event = JSON.parse(log.mock.calls[0][1])
    expect(event).toMatchObject({
      event: "query.failed",
      requestId: task.id,
      stage: "history.compare",
      state: "executing",
      code: "57014",
      reason: "statement_cancelled",
      batch: 1,
      batchSize: 64,
      completed: 0,
      total: 2271,
    })
    expect(JSON.stringify(log.mock.calls)).not.toMatch(
      /private|secret|password|SELECT/
    )
    expect(client.release).toHaveBeenCalledTimes(1)
  })

  it("reports connection waits separately from a query that has not completed its first batch", async () => {
    vi.useFakeTimers()
    const log = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { pool, client, tracked } = testPool()
    let connect!: (value: typeof client) => void
    let complete!: (value: { rows: never[]; rowCount: number }) => void
    pool.connect.mockImplementation(
      () =>
        new Promise((resolve) => {
          connect = resolve
        })
    )
    client.query.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        })
    )
    const result = withDatabaseStage("history.compare", () =>
      tracked.query("SELECT 1")
    )
    await vi.advanceTimersByTimeAsync(5000)
    expect(JSON.parse(log.mock.calls[0][1])).toMatchObject({
      event: "query.running",
      state: "waiting_for_connection",
      elapsedMs: 5000,
      poolWaiting: 2,
    })
    connect(client)
    await vi.advanceTimersByTimeAsync(5000)
    expect(JSON.parse(log.mock.calls[1][1])).toMatchObject({
      event: "query.running",
      state: "executing",
      connectionMs: 5000,
      elapsedMs: 10000,
    })
    complete({ rows: [], rowCount: 0 })
    await result
    expect(JSON.parse(log.mock.calls[2][1])).toMatchObject({
      event: "query.completed",
      elapsedMs: 10000,
      rows: 0,
    })
    await vi.advanceTimersByTimeAsync(10000)
    expect(log).toHaveBeenCalledTimes(3)
  })

  it("logs connection failures and stays quiet for fast successful queries unless debug is enabled", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {})
    const infoLog = vi.spyOn(console, "info").mockImplementation(() => {})
    const { tracked, pool } = testPool()
    await tracked.query("SELECT 1")
    expect(infoLog).not.toHaveBeenCalled()
    vi.stubEnv("DB_QUERY_DEBUG", "true")
    await tracked.query("SELECT 1")
    expect(infoLog).toHaveBeenCalledTimes(2)
    pool.connect.mockRejectedValue(
      Object.assign(new Error("password"), { code: "ECONNREFUSED" })
    )
    await expect(tracked.query("SELECT 1")).rejects.toThrow()
    expect(JSON.parse(errorLog.mock.calls[0][1])).toMatchObject({
      event: "query.failed",
      state: "waiting_for_connection",
      code: "ECONNREFUSED",
    })
  })

  it("unwraps database causes and rejects arbitrary codes, messages and recursive causes", () => {
    expect(
      safeDatabaseError(
        new DataAccessError({ code: "42501", detail: "private" })
      )
    ).toMatchObject({ code: "42501", reason: "permission_denied" })
    expect(safeDatabaseError({ code: "password=sentinel" })).toEqual({
      code: "unknown",
      reason: "unknown",
    })
    const cycle: { cause?: unknown } = {}
    cycle.cause = cycle
    expect(safeDatabaseError(cycle)).toEqual({
      code: "unknown",
      reason: "unknown",
    })
    expect(
      safeDatabaseError(new Error("timeout exceeded when trying to connect"))
    ).toEqual({ code: "unknown", reason: "connection_timeout" })
  })

  it("handles a checked-out connection error and discards the failed connection", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const { tracked, client } = testPool()
    const error = Object.assign(new Error("sensitive socket details"), {
      code: "ECONNRESET",
    })
    client.query.mockImplementation(() => {
      client.emit("error", error)
      return Promise.reject(error)
    })
    await expect(tracked.query("SELECT 1")).rejects.toBe(error)
    expect(client.release).toHaveBeenCalledWith(true)
    expect(client.listenerCount("error")).toBe(0)
  })
})
