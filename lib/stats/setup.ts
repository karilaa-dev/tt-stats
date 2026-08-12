import "@tanstack/react-start/server-only"

import type { Pool, PoolClient } from "pg"

import snapshotSchemaSql from "@/database/001_stats_snapshot_schema.sql?raw"
import { classifyDatabaseError, getPool } from "@/lib/db/pool"
import {
  getInstallerPool,
  hasDedicatedInstallerConnection,
} from "@/lib/db/installer"
import type {
  ConfigureDatabaseJobsResult,
  DatabaseSetupStatus,
} from "@/lib/stats/setup-types"

interface DatabaseIdentity {
  database: string
  role: string
}

interface AppCapabilities extends DatabaseIdentity {
  schema_installed: boolean
  tables_installed: boolean
  jobs_api_installed: boolean
  app_can_read: boolean
  app_can_manage: boolean
  pg_cron_installed: boolean
  pg_cron_version: string | null
}

interface InstallerCapabilities extends DatabaseIdentity {
  can_create: boolean
  superuser: boolean
  pg_cron_installed: boolean
  pg_cron_version: string | null
}

const fixedJobs = {
  rolling_24h: {
    name: "tt-stats-rolling-24h",
    command: "CALL tt_stats_cache.refresh_rolling_24h()",
  },
  daily: {
    name: "tt-stats-daily",
    command: "CALL tt_stats_cache.refresh_daily()",
  },
} as const

function emptyStatus(): DatabaseSetupStatus {
  return {
    appConnection: { ok: false, errorKind: null },
    installerConnection: {
      configured: false,
      ok: false,
      sameDatabase: false,
      canCreate: false,
      superuser: false,
      errorKind: null,
    },
    snapshot: {
      schemaInstalled: false,
      tablesInstalled: false,
      jobsApiInstalled: false,
      appCanRead: false,
      appCanManageJobs: false,
      rollingSeeded: false,
      dailySeeded: false,
    },
    scheduler: {
      pgCronInstalled: false,
      pgCronVersion: null,
      inspectable: false,
      rollingJobInstalled: false,
      dailyJobInstalled: false,
    },
    ready: false,
  }
}

async function inspectApp(pool: Pool): Promise<AppCapabilities> {
  const result = await pool.query<AppCapabilities>(`
    SELECT current_database() AS database,
           current_user AS role,
           to_regnamespace('tt_stats_cache') IS NOT NULL AS schema_installed,
           to_regclass('tt_stats_cache.refresh_metadata') IS NOT NULL
             AND to_regclass('tt_stats_cache.breakdown') IS NOT NULL
             AND to_regclass('tt_stats_cache.time_series') IS NOT NULL
             AND to_regclass('tt_stats_cache.rankings') IS NOT NULL
             AND to_regclass('tt_stats_cache.scalars') IS NOT NULL
             AS tables_installed,
           to_regprocedure('tt_stats_cache.list_stats_jobs()') IS NOT NULL
             AS jobs_api_installed,
           coalesce(has_schema_privilege(current_user, to_regnamespace('tt_stats_cache'), 'USAGE'), false)
             AND coalesce(has_table_privilege(current_user, to_regclass('tt_stats_cache.refresh_metadata'), 'SELECT'), false)
             AND coalesce(has_table_privilege(current_user, to_regclass('tt_stats_cache.breakdown'), 'SELECT'), false)
             AND coalesce(has_table_privilege(current_user, to_regclass('tt_stats_cache.time_series'), 'SELECT'), false)
             AND coalesce(has_table_privilege(current_user, to_regclass('tt_stats_cache.rankings'), 'SELECT'), false)
             AND coalesce(has_table_privilege(current_user, to_regclass('tt_stats_cache.scalars'), 'SELECT'), false)
             AS app_can_read,
           coalesce(has_function_privilege(current_user, to_regprocedure('tt_stats_cache.list_stats_jobs()'), 'EXECUTE'), false)
             AND coalesce(has_function_privilege(current_user, to_regprocedure('tt_stats_cache.list_stats_job_runs(text,integer)'), 'EXECUTE'), false)
             AND coalesce(has_function_privilege(current_user, to_regprocedure('tt_stats_cache.update_stats_job_schedule(text,text)'), 'EXECUTE'), false)
             AND coalesce(has_function_privilege(current_user, to_regprocedure('tt_stats_cache.set_stats_job_active(text,boolean)'), 'EXECUTE'), false)
             AND coalesce(has_function_privilege(current_user, to_regprocedure('tt_stats_cache.request_stats_job_run(text)'), 'EXECUTE'), false)
             AS app_can_manage,
           EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
             AS pg_cron_installed,
           (SELECT extversion FROM pg_extension WHERE extname = 'pg_cron')
             AS pg_cron_version
  `)
  const row = result.rows[0]
  if (!row) throw new Error("capability query returned no rows")
  return row
}

async function inspectInstaller(pool: Pool): Promise<InstallerCapabilities> {
  const result = await pool.query<InstallerCapabilities>(`
    SELECT current_database() AS database,
           current_user AS role,
           has_database_privilege(current_user, current_database(), 'CREATE')
             AS can_create,
           rolsuper AS superuser,
           EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
             AS pg_cron_installed,
           (SELECT extversion FROM pg_extension WHERE extname = 'pg_cron')
             AS pg_cron_version
    FROM pg_roles
    WHERE rolname = current_user
  `)
  const row = result.rows[0]
  if (!row) throw new Error("installer capability query returned no rows")
  return row
}

async function inspectSnapshots(pool: Pool): Promise<Set<string>> {
  const result = await pool.query<{ dataset: string }>(
    "SELECT dataset FROM tt_stats_cache.refresh_metadata"
  )
  return new Set(result.rows.map((row) => row.dataset))
}

async function inspectJobs(pool: Pool): Promise<Set<string>> {
  const result = await pool.query<{
    job_name: string
    schedule: string | null
  }>("SELECT job_name, schedule FROM tt_stats_cache.list_stats_jobs()")
  return new Set(
    result.rows.filter((row) => row.schedule).map((row) => row.job_name)
  )
}

export async function getDatabaseSetupStatusRaw(): Promise<DatabaseSetupStatus> {
  const status = emptyStatus()
  let app: AppCapabilities | null = null
  let installer: InstallerCapabilities | null = null

  try {
    app = await inspectApp(getPool())
    status.appConnection.ok = true
    status.snapshot.schemaInstalled = app.schema_installed
    status.snapshot.tablesInstalled = app.tables_installed
    status.snapshot.jobsApiInstalled = app.jobs_api_installed
    status.snapshot.appCanRead = app.app_can_read
    status.snapshot.appCanManageJobs = app.app_can_manage
    status.scheduler.pgCronInstalled = app.pg_cron_installed
    status.scheduler.pgCronVersion = app.pg_cron_version

    if (app.tables_installed && app.app_can_read) {
      const datasets = await inspectSnapshots(getPool())
      status.snapshot.rollingSeeded = datasets.has("rolling_24h")
      status.snapshot.dailySeeded = datasets.has("daily")
    }
    if (app.jobs_api_installed && app.app_can_manage && app.pg_cron_installed) {
      const jobs = await inspectJobs(getPool())
      status.scheduler.inspectable = true
      status.scheduler.rollingJobInstalled = jobs.has(
        fixedJobs.rolling_24h.name
      )
      status.scheduler.dailyJobInstalled = jobs.has(fixedJobs.daily.name)
    }
  } catch (error) {
    status.appConnection.errorKind = classifyDatabaseError(error)
  }

  status.installerConnection.configured = hasDedicatedInstallerConnection()
  try {
    installer = await inspectInstaller(getInstallerPool())
    status.installerConnection.ok = true
    status.installerConnection.canCreate = installer.can_create
    status.installerConnection.superuser = installer.superuser
    status.installerConnection.sameDatabase = Boolean(
      app && app.database === installer.database
    )
    status.scheduler.pgCronInstalled = installer.pg_cron_installed
    status.scheduler.pgCronVersion = installer.pg_cron_version
  } catch (error) {
    status.installerConnection.errorKind = classifyDatabaseError(error)
  }

  status.ready =
    status.appConnection.ok &&
    status.snapshot.tablesInstalled &&
    status.snapshot.jobsApiInstalled &&
    status.snapshot.appCanRead &&
    status.snapshot.appCanManageJobs &&
    status.snapshot.rollingSeeded &&
    status.snapshot.dailySeeded &&
    status.scheduler.pgCronInstalled &&
    status.scheduler.rollingJobInstalled &&
    status.scheduler.dailyJobInstalled

  return status
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

async function ensureFixedJob(
  client: PoolClient,
  job: (typeof fixedJobs)[keyof typeof fixedJobs],
  schedule: string
): Promise<void> {
  const existing = await client.query<{ jobid: string }>(
    "SELECT jobid::text FROM cron.job WHERE jobname = $1",
    [job.name]
  )
  const jobId = existing.rows[0]?.jobid
  if (jobId) {
    await client.query(
      "SELECT cron.alter_job($1::bigint, schedule := $2, command := $3)",
      [jobId, schedule, job.command]
    )
    return
  }
  await client.query("SELECT cron.schedule($1, $2, $3)", [
    job.name,
    schedule,
    job.command,
  ])
}

function setupFailure(step: string, error: unknown): Error {
  const kind = classifyDatabaseError(error)
  if (kind === "configuration") {
    return new Error(
      "DB_URL or DB_ADMIN_URL is missing or malformed. Correct the server environment and restart the web process."
    )
  }
  if (kind === "connection") {
    return new Error(
      "The installer connection could not reach PostgreSQL. Check DB_ADMIN_URL and network access."
    )
  }
  if (kind === "permission") {
    return new Error(
      `Database setup stopped during ${step} because the installer role lacks permission. Configure DB_ADMIN_URL with a database-owner connection.`
    )
  }
  if (step === "pg_cron installation") {
    return new Error(
      "pg_cron could not be enabled. Confirm it is installed on the PostgreSQL host, preloaded, and configured for this database."
    )
  }
  if (step === "job scheduling") {
    return new Error(
      "PostgreSQL rejected the cron configuration. Check both schedule expressions and pg_cron availability."
    )
  }
  return new Error(
    `Database setup stopped during ${step}. No existing snapshots or schedules were deleted.`
  )
}

export async function configureDatabaseJobsRaw(input: {
  rollingSchedule: string
  dailySchedule: string
}): Promise<ConfigureDatabaseJobsResult> {
  let appPool: Pool
  let installerPool: Pool
  try {
    appPool = getPool()
    installerPool = getInstallerPool()
  } catch (error) {
    throw setupFailure("connection verification", error)
  }
  let appIdentity
  let installerIdentity
  try {
    ;[appIdentity, installerIdentity] = await Promise.all([
      appPool.query<DatabaseIdentity>(
        "SELECT current_database() AS database, current_user AS role"
      ),
      installerPool.query<DatabaseIdentity>(
        "SELECT current_database() AS database, current_user AS role"
      ),
    ])
  } catch (error) {
    throw setupFailure("connection verification", error)
  }
  const app = appIdentity.rows[0]
  const installer = installerIdentity.rows[0]
  if (!app || !installer || app.database !== installer.database) {
    throw new Error(
      "DB_URL and DB_ADMIN_URL must connect to the same PostgreSQL database."
    )
  }

  let client: PoolClient
  try {
    client = await installerPool.connect()
  } catch (error) {
    throw setupFailure("installer connection", error)
  }
  try {
    try {
      await client.query(snapshotSchemaSql)
    } catch (error) {
      throw setupFailure("snapshot schema installation", error)
    }

    try {
      await client.query("CREATE EXTENSION IF NOT EXISTS pg_cron")
    } catch (error) {
      throw setupFailure("pg_cron installation", error)
    }

    try {
      await ensureFixedJob(client, fixedJobs.rolling_24h, input.rollingSchedule)
      await ensureFixedJob(client, fixedJobs.daily, input.dailySchedule)
    } catch (error) {
      throw setupFailure("job scheduling", error)
    }

    try {
      const role = quoteIdentifier(app.role)
      await client.query(`
        GRANT USAGE ON SCHEMA tt_stats_cache TO ${role};
        GRANT SELECT ON tt_stats_cache.refresh_metadata,
                        tt_stats_cache.breakdown,
                        tt_stats_cache.time_series,
                        tt_stats_cache.rankings,
                        tt_stats_cache.scalars
        TO ${role};
        GRANT EXECUTE ON FUNCTION tt_stats_cache.list_stats_jobs() TO ${role};
        GRANT EXECUTE ON FUNCTION tt_stats_cache.list_stats_job_runs(TEXT, INTEGER) TO ${role};
        GRANT EXECUTE ON FUNCTION tt_stats_cache.update_stats_job_schedule(TEXT, TEXT) TO ${role};
        GRANT EXECUTE ON FUNCTION tt_stats_cache.set_stats_job_active(TEXT, BOOLEAN) TO ${role};
        GRANT EXECUTE ON FUNCTION tt_stats_cache.request_stats_job_run(TEXT) TO ${role};
        GRANT EXECUTE ON FUNCTION tt_stats_cache.get_manual_refresh_request(BIGINT) TO ${role}
      `)
    } catch (error) {
      throw setupFailure("application grants", error)
    }
  } finally {
    client.release()
  }

  const queuedDatasets: ConfigureDatabaseJobsResult["queuedDatasets"] = []
  const warnings: string[] = []
  for (const dataset of ["rolling_24h", "daily"] as const) {
    try {
      await appPool.query("SELECT tt_stats_cache.request_stats_job_run($1)", [
        dataset,
      ])
      queuedDatasets.push(dataset)
    } catch {
      warnings.push(
        `${dataset === "rolling_24h" ? "Rolling" : "Daily"} refresh was not queued; use Run now after reloading the page.`
      )
    }
  }

  return { queuedDatasets, warnings }
}
