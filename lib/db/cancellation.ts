import "@/lib/server-only"
import { Pool, type PoolClient, type QueryResultRow } from "pg"
import { currentDatabaseTask } from "@/lib/tasks/server"
import { databaseDiagnostic, startQueryDiagnostic } from "./diagnostics"

const cancellationPools = new WeakMap<object, Pool>()
function cancelPool(pool: Pool) {
  let cancellation = cancellationPools.get(pool.options)
  if (!cancellation) {
    // Separate capacity ensures a full read pool can always be cancelled.
    cancellation = new Pool({
      ...pool.options,
      max: 2,
      connectionTimeoutMillis: 2_000,
      query_timeout: 2_000,
      statement_timeout: 2_000,
      idleTimeoutMillis: 1_000,
      allowExitOnIdle: true,
      application_name: "tt-stats-cancel",
    })
    cancellation.on("error", (error) =>
      databaseDiagnostic("cancel.failed", { error }, "error")
    )
    cancellationPools.set(pool.options, cancellation)
  }
  return cancellation
}

export function cancelClient(
  pool: Pool,
  client: PoolClient,
  requestId = currentDatabaseTask()?.id
) {
  const pid = (client as PoolClient & { processID: number }).processID
  databaseDiagnostic("cancel.requested", { requestId })
  return cancelPool(pool)
    .query<{ cancelled: boolean }>(
      "SELECT pg_cancel_backend($1) AS cancelled",
      [pid]
    )
    .then((result) => {
      const cancelled = result.rows[0]?.cancelled === true
      databaseDiagnostic(
        cancelled ? "cancel.completed" : "cancel.unavailable",
        { requestId },
        cancelled ? "info" : "warn"
      )
    })
    .catch((error: unknown) => {
      databaseDiagnostic("cancel.failed", { requestId, error }, "error")
      // statement_timeout remains the fallback if the control connection fails.
    })
}

export async function cancellableQuery<Row extends QueryResultRow>(
  pool: Pool,
  text: string,
  values: unknown[] = [],
  signal?: AbortSignal
) {
  signal?.throwIfAborted()
  const requestId = currentDatabaseTask()?.id
  const diagnostic = startQueryDiagnostic(pool, requestId)
  let client: PoolClient | undefined
  let failed = false
  const onClientError = () => {
    // pg rejects the active query as well as emitting this event. Keep a
    // listener while checked out so a dropped socket cannot crash the process.
    failed = true
  }
  let cancellation: Promise<unknown> | undefined
  const cancel = () => {
    // The PID comes only from this checked-out connection, never from a request.
    if (client) cancellation = cancelClient(pool, client, requestId)
  }
  try {
    client = await pool.connect()
    client.on("error", onClientError)
    diagnostic.connected()
    signal?.throwIfAborted()
    const pending = client.query<Row>(text, values)
    signal?.addEventListener("abort", cancel, { once: true })
    const result = await pending
    signal?.throwIfAborted()
    diagnostic.finish(undefined, result.rowCount)
    return result
  } catch (error) {
    failed = true
    diagnostic.finish(error, undefined, signal?.aborted)
    throw error
  } finally {
    signal?.removeEventListener("abort", cancel)
    // Don't reuse the connection before a late cancel signal has arrived.
    await cancellation
    client?.removeListener("error", onClientError)
    client?.release(failed || signal?.aborted)
  }
}

export function trackPool(pool: Pool): Pool {
  return new Proxy(pool, {
    get(target, property) {
      if (property === "query")
        return (text: string, values?: unknown[]) => {
          const task = currentDatabaseTask()
          return cancellableQuery(target, text, values, task?.controller.signal)
        }
      const value = Reflect.get(target, property)
      return typeof value === "function" ? value.bind(target) : value
    },
  })
}
