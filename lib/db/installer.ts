import "@tanstack/react-start/server-only"

import { Pool } from "pg"

import { getPool } from "@/lib/db/pool"
import { getDbEnv } from "@/lib/env"

const globalForInstaller = globalThis as typeof globalThis & {
  ttStatsInstallerPool?: Pool
}

export function hasDedicatedInstallerConnection(): boolean {
  return Boolean(process.env.DB_ADMIN_URL?.trim())
}

export function getInstallerPool(): Pool {
  const env = getDbEnv()
  if (!env.DB_ADMIN_URL || env.DB_ADMIN_URL === env.DB_URL) return getPool()
  if (globalForInstaller.ttStatsInstallerPool) {
    return globalForInstaller.ttStatsInstallerPool
  }

  const pool = new Pool({
    connectionString: env.DB_ADMIN_URL,
    max: 1,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 60_000,
    application_name: "tt-stats-installer",
  })
  pool.on("error", (error) => {
    const code = (error as NodeJS.ErrnoException).code ?? "unknown"
    console.error("[database-installer] idle client error", { code })
  })
  globalForInstaller.ttStatsInstallerPool = pool
  return pool
}
