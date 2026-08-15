import "@tanstack/react-start/server-only"

import type { Pool, PoolClient } from "pg"

import snapshotSchemaSql from "@/database/001_stats_snapshot_schema.sql?raw"
import { classifyDatabaseError, getPool } from "@/lib/db/pool"
import type {
  ConfigureDatabaseJobsResult,
  DatabaseSetupStatus,
} from "@/lib/stats/setup-types"

const snapshotDefinitionUpdateSql = snapshotSchemaSql.replace(
  "CREATE SCHEMA IF NOT EXISTS tt_stats_cache;",
  "-- Existing tt_stats_cache schema ownership was verified by the app."
)

interface DatabaseIdentity {
  database: string
  role: string
}

interface AppCapabilities extends DatabaseIdentity {
  can_create: boolean
  can_create_temporary_tables: boolean
  can_read_source_tables: boolean
  can_use_cron: boolean
  superuser: boolean
  schema_installed: boolean
  tables_installed: boolean
  jobs_api_installed: boolean
  definitions_current: boolean
  owns_snapshot_schema: boolean
  app_can_read: boolean
  app_can_manage: boolean
  app_can_monitor_downloads: boolean
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
    databaseRole: {
      canCreate: false,
      canCreateTemporaryTables: false,
      canReadSourceTables: false,
      canUseCron: false,
      superuser: false,
    },
    snapshot: {
      schemaInstalled: false,
      tablesInstalled: false,
      jobsApiInstalled: false,
      definitionsCurrent: false,
      appCanRead: false,
      appCanManageJobs: false,
      appCanMonitorDownloads: false,
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
           has_database_privilege(current_user, current_database(), 'CREATE')
             AS can_create,
           has_database_privilege(current_user, current_database(), 'TEMPORARY')
             AS can_create_temporary_tables,
           coalesce(has_schema_privilege(current_user, to_regnamespace('public'), 'USAGE'), false)
             AND coalesce(has_table_privilege(current_user, to_regclass('public.users'), 'SELECT'), false)
             AND coalesce(has_table_privilege(current_user, to_regclass('public.videos'), 'SELECT'), false)
             AND coalesce(has_table_privilege(current_user, to_regclass('public.music'), 'SELECT'), false)
             AS can_read_source_tables,
           coalesce(has_schema_privilege(current_user, to_regnamespace('cron'), 'USAGE'), false)
             AS can_use_cron,
           (SELECT rolsuper FROM pg_roles WHERE rolname = current_user)
             AS superuser,
           to_regnamespace('tt_stats_cache') IS NOT NULL AS schema_installed,
           to_regclass('tt_stats_cache.refresh_metadata') IS NOT NULL
             AND to_regclass('tt_stats_cache.breakdown') IS NOT NULL
             AND to_regclass('tt_stats_cache.time_series') IS NOT NULL
             AND to_regclass('tt_stats_cache.rankings') IS NOT NULL
             AND to_regclass('tt_stats_cache.scalars') IS NOT NULL
             AS tables_installed,
           to_regprocedure('tt_stats_cache.list_stats_jobs()') IS NOT NULL
             AS jobs_api_installed,
           coalesce(
             obj_description(
               to_regprocedure('tt_stats_cache.refresh_rolling_24h(timestamptz)'),
               'pg_proc'
             ) = 'tt-stats-schema-version:3',
             false
           ) AS definitions_current,
           coalesce(
             (
               SELECT pg_get_userbyid(namespace.nspowner) = current_user
               FROM pg_namespace namespace
               WHERE namespace.oid = to_regnamespace('tt_stats_cache')
             ),
             false
           ) AS owns_snapshot_schema,
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
           coalesce(has_table_privilege(current_user, to_regclass('tt_stats_cache.video_inactivity_monitor'), 'SELECT'), false)
             AND coalesce(has_table_privilege(current_user, to_regclass('tt_stats_cache.video_inactivity_monitor'), 'UPDATE'), false)
             AND coalesce(has_schema_privilege(current_user, to_regnamespace('public'), 'USAGE'), false)
             AND coalesce(has_table_privilege(current_user, to_regclass('public.videos'), 'SELECT'), false)
             AS app_can_monitor_downloads,
           EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
             AS pg_cron_installed,
           (SELECT extversion FROM pg_extension WHERE extname = 'pg_cron')
             AS pg_cron_version
  `)
  const row = result.rows[0]
  if (!row) throw new Error("capability query returned no rows")
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

  try {
    const app = await inspectApp(getPool())
    status.appConnection.ok = true
    status.databaseRole.canCreate = app.can_create
    status.databaseRole.canCreateTemporaryTables =
      app.can_create_temporary_tables
    status.databaseRole.canReadSourceTables = app.can_read_source_tables
    status.databaseRole.canUseCron = app.can_use_cron
    status.databaseRole.superuser = app.superuser
    status.snapshot.schemaInstalled = app.schema_installed
    status.snapshot.tablesInstalled = app.tables_installed
    status.snapshot.jobsApiInstalled = app.jobs_api_installed
    status.snapshot.definitionsCurrent = app.definitions_current
    status.snapshot.appCanRead = app.app_can_read
    status.snapshot.appCanManageJobs = app.app_can_manage
    status.snapshot.appCanMonitorDownloads = app.app_can_monitor_downloads
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

  status.ready =
    status.appConnection.ok &&
    status.snapshot.tablesInstalled &&
    status.snapshot.jobsApiInstalled &&
    status.snapshot.definitionsCurrent &&
    status.snapshot.appCanRead &&
    status.snapshot.appCanManageJobs &&
    status.snapshot.appCanMonitorDownloads &&
    !status.databaseRole.superuser &&
    status.databaseRole.canCreateTemporaryTables &&
    status.databaseRole.canReadSourceTables &&
    status.databaseRole.canUseCron &&
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
      "DB_URL is missing or malformed. Correct the server environment and restart the web process."
    )
  }
  if (kind === "connection") {
    return new Error(
      "DB_URL could not reach PostgreSQL. Check the database address, port, and network access."
    )
  }
  if (kind === "permission") {
    return new Error(
      `Database setup stopped during ${step} because DB_URL lacks a required limited grant. Follow the administrator guide on Database jobs, then retry.`
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
  setupPrivilegesConfirmed: true
}): Promise<ConfigureDatabaseJobsResult> {
  if (input.setupPrivilegesConfirmed !== true) {
    throw new Error(
      "Confirm that DB_URL has the listed non-superuser grants before running database setup."
    )
  }

  let pool: Pool
  try {
    pool = getPool()
  } catch (error) {
    throw setupFailure("connection verification", error)
  }
  let capabilities
  try {
    capabilities = await inspectApp(pool)
  } catch (error) {
    throw setupFailure("connection verification", error)
  }
  if (capabilities.superuser) {
    throw new Error(
      "DB_URL is a PostgreSQL superuser. Configure the dedicated non-superuser role described on Database jobs, then retry."
    )
  }
  if (!capabilities.pg_cron_installed) {
    throw new Error(
      "pg_cron is not installed in this database. Complete the one-time PostgreSQL administrator steps shown on Database jobs, then retry."
    )
  }

  const missingPrivileges = [
    capabilities.can_create ? null : "CREATE on this database",
    capabilities.can_create_temporary_tables
      ? null
      : "TEMPORARY on this database",
    capabilities.can_read_source_tables
      ? null
      : "USAGE on public and SELECT on users, videos, and music",
    capabilities.can_use_cron ? null : "USAGE on the cron schema",
  ].filter((value): value is string => Boolean(value))
  if (missingPrivileges.length) {
    throw new Error(
      `DB_URL is missing: ${missingPrivileges.join(", ")}. Apply the limited grants from the administrator guide, then retry.`
    )
  }

  let client: PoolClient
  try {
    client = await pool.connect()
  } catch (error) {
    throw setupFailure("DB_URL connection", error)
  }
  try {
    try {
      await client.query(snapshotSchemaSql)
    } catch (error) {
      throw setupFailure("snapshot schema installation", error)
    }

    try {
      await ensureFixedJob(client, fixedJobs.rolling_24h, input.rollingSchedule)
      await ensureFixedJob(client, fixedJobs.daily, input.dailySchedule)
    } catch (error) {
      throw setupFailure("job scheduling", error)
    }

    try {
      const role = quoteIdentifier(capabilities.role)
      await client.query(`
        GRANT USAGE ON SCHEMA tt_stats_cache TO ${role};
        GRANT SELECT ON tt_stats_cache.refresh_metadata,
                        tt_stats_cache.breakdown,
                        tt_stats_cache.time_series,
                        tt_stats_cache.rankings,
                        tt_stats_cache.scalars
        TO ${role};
        GRANT SELECT, UPDATE ON tt_stats_cache.video_inactivity_monitor
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

  return queueSnapshotRefreshes(pool)
}

async function queueSnapshotRefreshes(
  pool: Pool
): Promise<ConfigureDatabaseJobsResult> {
  const queuedDatasets: ConfigureDatabaseJobsResult["queuedDatasets"] = []
  const warnings: string[] = []
  for (const dataset of ["rolling_24h", "daily"] as const) {
    try {
      await pool.query("SELECT tt_stats_cache.request_stats_job_run($1)", [
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

export async function updateDatabaseDefinitionsRaw(input: {
  setupPrivilegesConfirmed: true
}): Promise<ConfigureDatabaseJobsResult> {
  if (input.setupPrivilegesConfirmed !== true) {
    throw new Error(
      "Confirm that DB_URL owns the installed TT Stats schema before updating it."
    )
  }

  const pool = getPool()
  let capabilities
  try {
    capabilities = await inspectApp(pool)
  } catch (error) {
    throw setupFailure("connection verification", error)
  }
  if (capabilities.superuser) {
    throw new Error(
      "DB_URL is a PostgreSQL superuser. Use the dedicated non-superuser TT Stats role instead."
    )
  }
  if (!capabilities.schema_installed || !capabilities.owns_snapshot_schema) {
    throw new Error(
      "DB_URL does not own the installed TT Stats schema. Use the role that installed it, or transfer ownership before retrying."
    )
  }

  const missingPrivileges = [
    capabilities.can_create_temporary_tables
      ? null
      : "TEMPORARY on this database",
    capabilities.can_read_source_tables
      ? null
      : "USAGE on public and SELECT on users, videos, and music",
    capabilities.can_use_cron ? null : "USAGE on the cron schema",
  ].filter((value): value is string => Boolean(value))
  if (missingPrivileges.length) {
    throw new Error(
      `DB_URL is missing: ${missingPrivileges.join(", ")}. Apply the limited runtime grants from the administrator guide, then retry.`
    )
  }

  let client: PoolClient
  try {
    client = await pool.connect()
  } catch (error) {
    throw setupFailure("DB_URL connection", error)
  }
  try {
    try {
      await client.query(snapshotDefinitionUpdateSql)
    } catch (error) {
      try {
        await client.query("ROLLBACK")
      } catch {
        // The original sanitized setup error is more useful than rollback state.
      }
      throw setupFailure("database definition update", error)
    }
  } finally {
    client.release()
  }

  return queueSnapshotRefreshes(pool)
}
