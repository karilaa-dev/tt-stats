import "@/lib/server-only"
import { AsyncLocalStorage } from "node:async_hooks"
import { randomUUID } from "node:crypto"
import type { Pool } from "pg"

const stages = [
  "query",
  "history.count",
  "history.page",
  "history.identities",
  "history.compare",
  "history.rank",
  "diagnostic.metadata",
  "diagnostic.explain",
] as const
type DatabaseStage = (typeof stages)[number]
type Counts = Partial<
  Record<"batch" | "batchSize" | "completed" | "total" | "cached", number>
>
const scope = new AsyncLocalStorage<Counts & { stage: DatabaseStage }>()

export function withDatabaseStage<T>(
  stage: DatabaseStage,
  operation: () => T,
  counts: Counts = {}
) {
  return scope.run({ stage, ...counts }, operation)
}

const systemCodes = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
])
export function safeDatabaseError(error: unknown): {
  code: string
  reason: string
} {
  for (
    let depth = 0;
    depth < 6 && error && typeof error === "object";
    depth++
  ) {
    const value = error as {
      code?: unknown
      message?: unknown
      name?: unknown
      cause?: unknown
    }
    if (
      typeof value.code === "string" &&
      (systemCodes.has(value.code) ||
        /^(?:[0-9][0-9A-Z]|XX|P0|HV|F0)[0-9A-Z]{3}$/u.test(value.code))
    ) {
      const reason =
        value.code === "57014"
          ? "statement_cancelled"
          : value.code === "42501"
            ? "permission_denied"
            : value.code === "55P03"
              ? "lock_timeout"
              : value.code === "53300"
                ? "too_many_connections"
                : value.code === "53100"
                  ? "disk_full"
                  : value.code === "53200"
                    ? "out_of_memory"
                    : value.code.startsWith("08") || systemCodes.has(value.code)
                      ? "connection_error"
                      : "database_error"
      return { code: value.code, reason }
    }
    if (value.message === "Query read timeout")
      return { code: "unknown", reason: "client_query_timeout" }
    if (
      [
        "Connection terminated due to connection timeout",
        "timeout exceeded when trying to connect",
      ].includes(String(value.message))
    )
      return { code: "unknown", reason: "connection_timeout" }
    if (value.name === "AbortError")
      return { code: "unknown", reason: "request_cancelled" }
    error = value.cause
  }
  return { code: "unknown", reason: "unknown" }
}

type Event =
  | "query.started"
  | "query.running"
  | "query.completed"
  | "query.failed"
  | "query.cancelled"
  | "cancel.requested"
  | "cancel.completed"
  | "cancel.failed"
  | "cancel.unavailable"
  | "history.cache"
  | "diagnostic.failed"
type Fields = Counts & {
  requestId?: string
  queryId?: string
  stage?: DatabaseStage
  state?: "waiting_for_connection" | "executing"
  elapsedMs?: number
  connectionMs?: number
  rows?: number | null
  poolTotal?: number
  poolIdle?: number
  poolWaiting?: number
  error?: unknown
}

// Explicit fields only: never serialize pg errors, SQL, parameters, results,
// account IDs, links, session cookies, or connection settings.
export function databaseDiagnostic(
  event: Event,
  fields: Fields = {},
  level: "info" | "warn" | "error" = "info"
) {
  const record: Record<string, unknown> = { event }
  for (const field of ["requestId", "queryId"] as const) {
    if (fields[field] && /^[a-f0-9-]{36}$/u.test(fields[field]))
      record[field] = fields[field]
  }
  if (fields.stage && stages.includes(fields.stage)) record.stage = fields.stage
  if (fields.state === "waiting_for_connection" || fields.state === "executing")
    record.state = fields.state
  for (const field of [
    "batch",
    "batchSize",
    "completed",
    "total",
    "cached",
    "elapsedMs",
    "connectionMs",
    "rows",
    "poolTotal",
    "poolIdle",
    "poolWaiting",
  ] as const) {
    const value = fields[field]
    if (typeof value === "number" && Number.isFinite(value) && value >= 0)
      record[field] = Math.round(value)
  }
  if (fields.error !== undefined)
    Object.assign(record, safeDatabaseError(fields.error))
  console[level]("[database]", JSON.stringify(record))
}

export function logHistoryCache(
  total: number,
  cached: number,
  requestId?: string
) {
  if (process.env.DB_QUERY_DEBUG === "true")
    databaseDiagnostic("history.cache", { requestId, total, cached })
}

export function startQueryDiagnostic(pool: Pool, requestId?: string) {
  const started = performance.now()
  const verbose = process.env.DB_QUERY_DEBUG === "true"
  const context = scope.getStore() ?? { stage: "query" as const }
  const queryId = randomUUID()
  let state: Fields["state"] = "waiting_for_connection"
  let connectionMs: number | undefined
  let finished = false
  const fields = (): Fields => ({
    ...context,
    queryId,
    requestId,
    state,
    connectionMs,
    elapsedMs: performance.now() - started,
    poolTotal: pool.totalCount,
    poolIdle: pool.idleCount,
    poolWaiting: pool.waitingCount,
  })
  if (verbose) databaseDiagnostic("query.started", fields())
  const timer = setInterval(
    () => databaseDiagnostic("query.running", fields(), "warn"),
    5000
  )
  timer.unref?.()
  return {
    connected() {
      state = "executing"
      connectionMs = performance.now() - started
    },
    finish(error?: unknown, rows?: number | null, cancelled = false) {
      if (finished) return
      finished = true
      clearInterval(timer)
      const details = { ...fields(), rows, error }
      if (error !== undefined)
        databaseDiagnostic(
          cancelled ? "query.cancelled" : "query.failed",
          details,
          cancelled ? "info" : "error"
        )
      else if (verbose || details.elapsedMs! >= 1000)
        databaseDiagnostic(
          "query.completed",
          details,
          verbose ? "info" : "warn"
        )
    },
  }
}
