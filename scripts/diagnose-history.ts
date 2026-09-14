import { Pool } from "pg"
import { trackPool } from "../lib/db/cancellation"
import { databaseDiagnostic, withDatabaseStage } from "../lib/db/diagnostics"
import { getUserDownloadsRaw } from "../lib/stats/history"
import { parseTelegramId } from "../lib/stats/validation"
import { DatabaseTask, withDatabaseTask } from "../lib/tasks/server"

// Run on the application's network. All connections enforce read-only mode;
// this command never installs indexes, changes settings persistently, or prints
// SQL, parameters, credentials, account IDs, or individual download records.
async function main() {
  const args = process.argv.slice(2)
  const userId = parseTelegramId(args[0] ?? "")
  if (!userId || args.length > 2 || (args[1] && args[1] !== "--explain")) {
    console.error("Usage: bun dist/diagnose-history.mjs <user-id> [--explain]")
    process.exitCode = 1
    return
  }
  let url: URL
  try {
    url = new URL(process.env.DB_URL ?? "")
    if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error()
  } catch {
    console.error("Set DB_URL in the environment before running this command.")
    process.exitCode = 1
    return
  }
  url.searchParams.set(
    "options",
    "-c default_transaction_read_only=on -c statement_timeout=30000 -c lock_timeout=2000"
  )
  process.env.DB_QUERY_DEBUG = "true"
  const raw = new Pool({
    connectionString: url.href,
    max: 1,
    connectionTimeoutMillis: 5000,
    query_timeout: 35000,
    statement_timeout: 30000,
    application_name: "tt-stats-readonly-diagnostic",
  })
  raw.on("error", (error) =>
    databaseDiagnostic("diagnostic.failed", { error }, "error")
  )
  const pool = trackPool(raw)
  const task = new DatabaseTask()
  const abort = () => task.controller.abort()
  process.once("SIGINT", abort)
  process.once("SIGTERM", abort)
  const deadline = setTimeout(abort, 120000)
  const explained = new Error("Plan collected")
  let planCollected = false
  try {
    await withDatabaseTask(task, async () => {
      const settings = await withDatabaseStage("diagnostic.metadata", () =>
        pool.query(`SELECT
        current_setting('transaction_read_only') = 'on' AS read_only,
        current_setting('server_version_num')::int AS version,
        (SELECT setting::bigint FROM pg_settings WHERE name='work_mem') AS work_mem_kb,
        current_setting('jit') = 'on' AS jit`)
      )
      if (settings.rows[0]?.read_only !== true)
        throw new Error("Read-only mode required")
      console.info(
        "[database-diagnostic]",
        JSON.stringify({ event: "settings", ...settings.rows[0] })
      )
      const size = await withDatabaseStage("diagnostic.metadata", () =>
        pool.query(`SELECT
        c.reltuples::bigint AS estimated_rows, pg_relation_size(c.oid)::text AS table_bytes,
        s.last_analyze, s.last_autoanalyze, s.n_mod_since_analyze::text
        FROM pg_class c LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
        WHERE c.oid = 'public.videos'::regclass`)
      )
      console.info(
        "[database-diagnostic]",
        JSON.stringify({ event: "table", ...size.rows[0] })
      )
      const indexes = await withDatabaseStage("diagnostic.metadata", () =>
        pool.query(`SELECT
        i.indisvalid AS valid, i.indisready AS ready, i.indpred IS NOT NULL AS partial,
        i.indexprs IS NOT NULL AS expression,
        ARRAY(SELECT a.attname::text FROM unnest(i.indkey) WITH ORDINALITY AS k(num, position)
          LEFT JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.num
          ORDER BY k.position) AS columns,
        ci.relname = 'tt_stats_videos_legacy_link_idx' AS legacy_identity_index
        FROM pg_index i JOIN pg_class ci ON ci.oid=i.indexrelid WHERE i.indrelid='public.videos'::regclass`)
      )
      const knownColumns = new Set([
        "pk_id",
        "user_id",
        "video_details_id",
        "downloaded_at",
        "shared_link",
        "media_kind",
        "cache_hit",
        "delivery_surface",
        "delivery_mode",
      ])
      console.info(
        "[database-diagnostic]",
        JSON.stringify({
          event: "indexes",
          indexes: indexes.rows.map((row) => ({
            valid: row.valid,
            ready: row.ready,
            partial: row.partial,
            expression: row.expression,
            legacyIdentityIndex: row.legacy_identity_index,
            columns: row.columns.map((column: string | null) =>
              column === null
                ? "expression"
                : knownColumns.has(column)
                  ? column
                  : "other"
            ),
          })),
        })
      )
      // Capture the first real comparison's plan without executing it. Never
      // print EXPLAIN conditions, which can contain the account ID and links.
      const inspected =
        args[1] === "--explain"
          ? new Proxy(pool, {
              get(target, property) {
                if (property === "query")
                  return async (sql: string, values: unknown[]) => {
                    if (/WITH (?:identities|candidates) AS/u.test(sql)) {
                      const plan = await withDatabaseStage(
                        "diagnostic.explain",
                        () =>
                          target.query(`EXPLAIN (FORMAT JSON) ${sql}`, values)
                      )
                      const summary: Record<string, unknown>[] = []
                      function visit(
                        node: Record<string, unknown>,
                        depth: number
                      ) {
                        if (summary.length >= 200 || depth > 30) return
                        const entry: Record<string, unknown> = { depth }
                        // Node Type is PostgreSQL's operator name, not a SQL expression.
                        if (
                          typeof node["Node Type"] === "string" &&
                          /^[A-Za-z ]{1,50}$/u.test(node["Node Type"])
                        )
                          entry.node = node["Node Type"]
                        for (const name of [
                          "Startup Cost",
                          "Total Cost",
                          "Plan Rows",
                          "Plan Width",
                        ])
                          if (typeof node[name] === "number")
                            entry[name] = node[name]
                        summary.push(entry)
                        if (Array.isArray(node.Plans))
                          for (const child of node.Plans)
                            visit(child, depth + 1)
                      }
                      visit(plan.rows[0]["QUERY PLAN"][0].Plan, 0)
                      console.info(
                        "[database-diagnostic]",
                        JSON.stringify({ event: "plan", nodes: summary })
                      )
                      planCollected = true
                      throw explained
                    }
                    return target.query(sql, values)
                  }
                return Reflect.get(target, property)
              },
            })
          : pool
      const result = await getUserDownloadsRaw(userId, 1, 20, inspected, {
        mediaKind: "all",
        discovery: "all",
        sort: "popular",
      })
      console.info(
        "[database-diagnostic]",
        JSON.stringify({
          event: "history.completed",
          total: result.total,
          returned: result.items.length,
          elapsedMs: task.status().elapsedMs,
        })
      )
    })
  } catch (error) {
    if (!planCollected) {
      databaseDiagnostic(
        "diagnostic.failed",
        { requestId: task.id, elapsedMs: task.status().elapsedMs, error },
        "error"
      )
      process.exitCode = 1
    }
  } finally {
    clearTimeout(deadline)
    process.removeListener("SIGINT", abort)
    process.removeListener("SIGTERM", abort)
    await pool.end()
  }
}

await main().catch((error) => {
  databaseDiagnostic("diagnostic.failed", { error }, "error")
  process.exitCode = 1
})
