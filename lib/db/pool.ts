import "@tanstack/react-start/server-only"

import { Pool, type PoolClient, type QueryResultRow } from "pg"

import { getDbEnv } from "@/lib/env"

export class DataAccessError extends Error {
  constructor(cause?: unknown) {
    super("The statistics database is unavailable", { cause })
    this.name = "DataAccessError"
  }
}

const globalForDatabase = globalThis as typeof globalThis & {
  ttStatsPool?: Pool
}

export function getPool(): Pool {
  if (globalForDatabase.ttStatsPool) return globalForDatabase.ttStatsPool

  const env = getDbEnv()
  const pool = new Pool({
    connectionString: env.DB_URL,
    max: env.DB_POOL_SIZE,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    query_timeout: 30_000,
    statement_timeout: 30_000,
    application_name: "tt-stats",
  })

  pool.on("error", (error) => {
    const code = (error as NodeJS.ErrnoException).code ?? "unknown"
    console.error("[database] idle client error", { code })
  })

  globalForDatabase.ttStatsPool = pool
  return pool
}

export async function query<Row extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = []
): Promise<Row[]> {
  try {
    const result = await getPool().query<Row>(text, [...values])
    return result.rows
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? "unknown"
    console.error("[database] query failed", { code })
    throw new DataAccessError(error)
  }
}

export async function connect(): Promise<PoolClient> {
  try {
    return await getPool().connect()
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? "unknown"
    console.error("[database] connection failed", { code })
    throw new DataAccessError(error)
  }
}
