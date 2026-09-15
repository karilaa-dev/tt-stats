import "@/lib/server-only"
import type { Pool } from "pg"
import schema from "@/database/005_website.sql?raw"
import { getPool } from "./pool"
import { isFakeDataEnabled } from "@/lib/dev/fake-data"

const expected: Record<string, Record<string, string>> = {
  users: {
    telegram_id: "int8",
    display_name: "text",
    username: "text",
    first_login_at: "timestamptz",
    last_login_at: "timestamptz",
  },
  sessions: {
    token_hash: "text",
    telegram_id: "int8",
    created_at: "timestamptz",
    expires_at: "timestamptz",
  },
  login_transactions: {
    token_hash: "text",
    payload: "jsonb",
    expires_at: "timestamptz",
  },
  query_cache: {
    cache_key: "text",
    payload: "jsonb",
    computed_at: "timestamptz",
    expires_at: "timestamptz",
    lease_token: "text",
    lease_until: "timestamptz",
  },
}
export async function inspectWebsiteSchema(
  pool: Pick<Pool, "query"> = getPool(),
  allowMissing = false
) {
  const { rows } = await pool.query<{
    table_name: string
    column_name: string
    udt_name: string
    is_nullable: string
    column_default: string | null
  }>(
    "SELECT table_name, column_name, udt_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'tt_stats_web'"
  )
  const definitions = Object.fromEntries(
    Object.entries(expected).filter(
      ([table]) => !allowMissing || rows.some((row) => row.table_name === table)
    )
  )
  const incompatible = Object.entries(definitions).flatMap(([table, columns]) =>
    Object.entries(columns)
      .filter(
        ([column, type]) =>
          !rows.some(
            (row) =>
              row.table_name === table &&
              row.column_name === column &&
              row.udt_name === type
          )
      )
      .map(([column]) => `${table}.${column}`)
  )
  if (incompatible.length)
    throw new Error(
      `Incompatible website tables: ${incompatible.join(", ")}. Apply an explicit schema migration before restarting.`
    )
  for (const [table, columns] of Object.entries(definitions)) {
    for (const column of Object.keys(columns)) {
      const nullable =
        (table === "users" && column === "username") ||
        (table === "query_cache" && column !== "cache_key")
      if (
        rows.find(
          (row) => row.table_name === table && row.column_name === column
        )?.is_nullable !== (nullable ? "YES" : "NO")
      )
        throw new Error(`Incompatible website nullability: ${table}.${column}`)
    }
  }
  const keys = await pool.query<{ table_name: string; column_name: string }>(`
    SELECT t.relname AS table_name, a.attname AS column_name FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.conkey[1]
    WHERE n.nspname = 'tt_stats_web' AND c.contype = 'p' AND cardinality(c.conkey) = 1`)
  for (const [table, column] of Object.entries({
    users: "telegram_id",
    sessions: "token_hash",
    login_transactions: "token_hash",
    query_cache: "cache_key",
  })) {
    if (!(table in definitions)) continue
    if (
      !keys.rows.some(
        (row) => row.table_name === table && row.column_name === column
      )
    )
      throw new Error(`Incompatible website primary key: ${table}.${column}`)
  }
  for (const [table, column] of [
    ["users", "first_login_at"],
    ["users", "last_login_at"],
    ["sessions", "created_at"],
  ]) {
    if (
      table in definitions &&
      !rows.find(
        (row) => row.table_name === table && row.column_name === column
      )?.column_default
    )
      throw new Error(`Incompatible website default: ${table}.${column}`)
  }
  if ("sessions" in definitions) {
    const reference = await pool.query(`SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = to_regclass('tt_stats_web.sessions') AND c.contype = 'f'
        AND c.confrelid = to_regclass('tt_stats_web.users') AND c.confdeltype = 'c'
        AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = c.conrelid AND attname = 'telegram_id')]::smallint[]
        AND c.confkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = c.confrelid AND attname = 'telegram_id')]::smallint[]`)
    if (!reference.rows.length)
      throw new Error("Incompatible website session user reference")
  }
  if (Object.keys(definitions).length) {
    const access = await pool.query<{ allowed: boolean }>(
      `SELECT
      coalesce(has_schema_privilege(current_user, to_regnamespace('tt_stats_web'), 'USAGE'), false)
      AND bool_and(coalesce(has_table_privilege(current_user, to_regclass('tt_stats_web.' || t), p), false)) AS allowed
      FROM unnest($1::text[]) AS t CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) AS p
      WHERE (t = 'users' AND p <> 'DELETE') OR (t = 'sessions' AND p <> 'UPDATE')
        OR (t = 'login_transactions' AND p IN ('INSERT', 'DELETE')) OR t = 'query_cache'`,
      [Object.keys(definitions)]
    )
    if (!access.rows[0]?.allowed)
      throw new Error(
        "DB_URL lacks required read/write permissions on tt_stats_web website tables"
      )
  }
  return true
}

export async function initializeWebsiteSchema(pool: Pool = getPool()) {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query("SET LOCAL lock_timeout = '10s'")
    await client.query("SELECT pg_advisory_xact_lock(784621, 1)")
    await inspectWebsiteSchema(client, true)
    // Only missing objects are created; existing definitions and rows are preserved.
    await client.query(schema)
    await inspectWebsiteSchema(client)
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    client.release()
  }
}
const globalState = globalThis as typeof globalThis & {
  ttStatsWebsiteReady?: Promise<void>
}
export function ensureWebsiteSchema() {
  if (isFakeDataEnabled()) return Promise.resolve()
  if (!globalState.ttStatsWebsiteReady) {
    const pending = initializeWebsiteSchema()
    globalState.ttStatsWebsiteReady = pending
    void pending.catch(() => {
      if (globalState.ttStatsWebsiteReady === pending)
        globalState.ttStatsWebsiteReady = undefined
    })
  }
  return globalState.ttStatsWebsiteReady
}

export async function cleanWebsiteStorage(pool: Pool = getPool()) {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const lock = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_xact_lock(784621, 2) AS acquired"
    )
    if (lock.rows[0]?.acquired) {
      for (const table of ["sessions", "login_transactions", "query_cache"]) {
        const predicate =
          table === "query_cache"
            ? "(expires_at IS NULL OR expires_at <= now()) AND (lease_until IS NULL OR lease_until <= now())"
            : "expires_at <= now()"
        await client.query(
          `DELETE FROM tt_stats_web.${table} WHERE ctid IN (SELECT ctid FROM tt_stats_web.${table} WHERE ${predicate} LIMIT 1000)`
        )
      }
    }
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    client.release()
  }
}
