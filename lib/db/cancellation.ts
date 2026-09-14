import "@/lib/server-only"
import { Pool, type PoolClient, type QueryResultRow } from "pg"
import { currentDatabaseTask } from "@/lib/tasks/server"

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
    cancellation.on("error", () => {})
    cancellationPools.set(pool.options, cancellation)
  }
  return cancellation
}

export function cancelClient(pool: Pool, client: PoolClient) {
  const pid = (client as PoolClient & { processID: number }).processID
  return cancelPool(pool)
    .query("SELECT pg_cancel_backend($1)", [pid])
    .catch(() => {
      // statement_timeout remains the fallback if the control connection fails.
    })
}

export async function cancellableQuery<Row extends QueryResultRow>(
  pool: Pool,
  text: string,
  values: unknown[] = [],
  signal: AbortSignal
) {
  signal.throwIfAborted()
  const client = await pool.connect()
  let cancellation: Promise<unknown> | undefined
  const cancel = () => {
    // The PID comes only from this checked-out connection, never from a request.
    cancellation = cancelClient(pool, client)
  }
  try {
    signal.throwIfAborted()
    const pending = client.query<Row>(text, values)
    signal.addEventListener("abort", cancel, { once: true })
    const result = await pending
    signal.throwIfAborted()
    return result
  } finally {
    signal.removeEventListener("abort", cancel)
    // Don't reuse the connection before a late cancel signal has arrived.
    await cancellation
    client.release(signal.aborted)
  }
}

export function trackPool(pool: Pool): Pool {
  return new Proxy(pool, {
    get(target, property) {
      if (property === "query")
        return (text: string, values?: unknown[]) => {
          const task = currentDatabaseTask()
          return task
            ? cancellableQuery(target, text, values, task.controller.signal)
            : target.query(text, values)
        }
      const value = Reflect.get(target, property)
      return typeof value === "function" ? value.bind(target) : value
    },
  })
}
