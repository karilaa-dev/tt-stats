import "@/lib/server-only"

import { Pool, type PoolClient, type QueryResultRow } from "pg"

import { getDbEnv } from "@/lib/env"
import { trackPool } from "@/lib/db/cancellation"
import { safeDatabaseError } from "@/lib/db/diagnostics"
import { DATABASE_ERROR_COPY, type DatabaseErrorKind } from "@/lib/db/errors"

export class DataAccessError extends Error {
  readonly kind: DatabaseErrorKind

  constructor(cause?: unknown, kind = classifyDatabaseError(cause)) {
    super(DATABASE_ERROR_COPY[kind].description, { cause })
    this.name = "DataAccessError"
    this.kind = kind
  }
}

function nestedCode(error: unknown): string {
  if (!error || typeof error !== "object") return ""
  const candidate = error as { code?: unknown; cause?: unknown; name?: unknown }
  if (typeof candidate.code === "string") return candidate.code
  return candidate.cause ? nestedCode(candidate.cause) : ""
}

export function classifyDatabaseError(error: unknown): DatabaseErrorKind {
  if (error instanceof DataAccessError) return error.kind
  const code = nestedCode(error)

  if (
    ["ECONNREFUSED", "ENOTFOUND", "EHOSTUNREACH", "ENETUNREACH"].includes(
      code
    ) ||
    code.startsWith("08")
  ) {
    return "connection"
  }
  if (
    ["ETIMEDOUT", "57014"].includes(code) ||
    (error instanceof Error && error.message === "Query read timeout")
  )
    return "timeout"
  if (["42P01", "3F000", "42883", "42703"].includes(code))
    return "snapshotSchema"
  if (["22003", "22008"].includes(code)) return "snapshotData"
  if (code === "42501") return "permission"
  if (error && typeof error === "object" && "issues" in error) {
    return "configuration"
  }
  return "unavailable"
}

const globalForDatabase = globalThis as typeof globalThis & {
  ttStatsPool?: Pool
}

export function getPool(): Pool {
  if (globalForDatabase.ttStatsPool) return globalForDatabase.ttStatsPool

  let env
  try {
    env = getDbEnv()
  } catch (error) {
    throw new DataAccessError(error, "configuration")
  }
  const pool = new Pool({
    connectionString: env.DB_URL,
    max: env.DB_POOL_SIZE,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // Give PostgreSQL time to report statement cancellation before the client
    // read deadline expires and leaves the connection state uncertain.
    query_timeout: 35_000,
    statement_timeout: 30_000,
    application_name: "tt-stats",
  })

  pool.on("error", (error) => {
    console.error("[database] idle client error", safeDatabaseError(error))
  })

  globalForDatabase.ttStatsPool = trackPool(pool)
  return globalForDatabase.ttStatsPool
}

export async function query<Row extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = []
): Promise<Row[]> {
  try {
    const result = await getPool().query<Row>(text, [...values])
    return result.rows
  } catch (error) {
    throw new DataAccessError(error)
  }
}

export async function connect(): Promise<PoolClient> {
  try {
    return await getPool().connect()
  } catch (error) {
    console.error("[database] connection failed", safeDatabaseError(error))
    throw new DataAccessError(error)
  }
}

// Reserve capacity for session checks so a saturated query pool cannot prevent
// authentication of a cancellation or logout request. Both pools use DB_URL.
const authDatabase = globalThis as typeof globalThis & {
  ttStatsAuthPool?: Pool
}
export function getAuthPool(): Pool {
  if (!authDatabase.ttStatsAuthPool) {
    const env = getDbEnv()
    const pool = new Pool({
      connectionString: env.DB_URL,
      max: 2,
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000,
      query_timeout: 12000,
      idleTimeoutMillis: 10000,
      allowExitOnIdle: true,
      application_name: "tt-stats-auth",
    })
    pool.on("error", (error) =>
      console.error(
        "[database] session connection failed",
        safeDatabaseError(error)
      )
    )
    authDatabase.ttStatsAuthPool = pool
  }
  return authDatabase.ttStatsAuthPool
}
