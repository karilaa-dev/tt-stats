import "@/lib/server-only"
import type { Pool } from "pg"
import { getPool } from "@/lib/db/pool"
import { isFakeDataEnabled } from "@/lib/dev/fake-data"
import { getInstagramMonitorEnv, getScraperSchema } from "@/lib/env"
import { scraperTable } from "@/lib/scraper/queries"

type NotificationFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>

type DeadAccount = {
  id: string
  username: string | null
  reason: string | null
  incident: string
}

export async function deliverDeadAccounts(
  accounts: DeadAccount[],
  env: NonNullable<ReturnType<typeof getInstagramMonitorEnv>>,
  fetcher: NotificationFetcher = fetch
) {
  const headers: Record<string, string> = {
    "Content-Type": "text/plain; charset=utf-8",
    Title: "Instagram accounts need attention",
    Priority: "high",
    Tags: "warning",
  }
  if (env.token) headers.Authorization = `Bearer ${env.token}`
  // Keep batches below ntfy's default 4 KiB message limit, even with Unicode.
  const encoder = new TextEncoder()
  let body = `${accounts.length} Instagram account(s) marked dead by tt-scrap.\n`
  for (const account of accounts) {
    const line = `${account.username ? `@${account.username}` : account.id}: ${account.reason || "No reason recorded"}\n`
    if (encoder.encode(body + line).length > 3500) {
      body += "See Scraper accounts for the full list.\n"
      break
    }
    body += line
  }
  let response: Response
  try {
    response = await fetcher(env.url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    })
  } catch {
    throw new Error(
      "The Instagram notification destination could not be reached."
    )
  }
  if (!response.ok)
    throw new Error(`Instagram notification returned HTTP ${response.status}.`)
}

/** At-least-once delivery. A failed send is retried; successful incidents survive restarts. */
export async function checkDeadInstagramAccounts(
  options: {
    pool?: Pool
    env?: ReturnType<typeof getInstagramMonitorEnv>
    fetcher?: NotificationFetcher
  } = {}
): Promise<"disabled" | "locked" | "idle" | "sent"> {
  if (isFakeDataEnabled()) return "disabled"
  const env = options.env === undefined ? getInstagramMonitorEnv() : options.env
  if (!env) return "disabled"
  const schema = getScraperSchema()
  const accounts = scraperTable("scrap_instagram_accounts")
  const client = await (options.pool ?? getPool()).connect()
  let discard = false
  try {
    await client.query("BEGIN")
    const lock = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_xact_lock(784621, 3) AS acquired"
    )
    if (!lock.rows[0]?.acquired) {
      await client.query("ROLLBACK")
      return "locked"
    }
    // Recovered or removed accounts may alert again on a later death, including
    // older source rows without dead_at. Never clear state on a failed source read.
    await client.query(
      `DELETE FROM tt_stats_web.instagram_dead_notifications n
      WHERE source_schema = $1 AND NOT EXISTS (SELECT 1 FROM ${accounts} a WHERE a.id = n.account_id AND a.dead)`,
      [schema]
    )
    const { rows } = await client.query<DeadAccount>(
      `SELECT a.id, a.username, a.dead_reason AS reason,
      coalesce(extract(epoch FROM a.dead_at)::text, 'dead') AS incident
      FROM ${accounts} a LEFT JOIN tt_stats_web.instagram_dead_notifications n
        ON n.notification_key = json_build_array($1::text, a.id)::text
      WHERE a.dead AND n.incident IS DISTINCT FROM coalesce(extract(epoch FROM a.dead_at)::text, 'dead')
      ORDER BY a.dead_at NULLS FIRST, a.id LIMIT 25`,
      [schema]
    )
    if (rows.length) {
      await deliverDeadAccounts(rows, env, options.fetcher)
      for (const account of rows) {
        await client.query(
          `INSERT INTO tt_stats_web.instagram_dead_notifications
          (notification_key, source_schema, account_id, incident) VALUES (json_build_array($1::text, $2::text)::text, $1, $2, $3)
          ON CONFLICT (notification_key) DO UPDATE SET incident = EXCLUDED.incident, sent_at = now()`,
          [schema, account.id, account.incident]
        )
      }
    }
    await client.query("COMMIT")
    return rows.length ? "sent" : "idle"
  } catch (error) {
    // Discard on query timeouts too: do not queue rollback behind an active query.
    discard = true
    throw error
  } finally {
    client.release(discard)
  }
}
